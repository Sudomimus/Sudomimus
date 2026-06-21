"""High-level helpers for automatic Device API polling."""

from __future__ import annotations

import asyncio
import inspect
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import TYPE_CHECKING

from sudomimus_connect import AsyncTokenStore, TokenPair, TokenStore

from ._generated.models import (
    DeviceAuthorizeRequest,
    DeviceAuthorizeResponse,
    DeviceTokenRequest,
    DeviceTokenResponse,
)
from .errors import DevicePollTimeoutError, DeviceTokenApiError

if TYPE_CHECKING:
    from .async_client import AsyncDeviceClient
    from .client import DeviceClient


@dataclass(frozen=True, slots=True)
class DevicePollProgress:
    """Progress callback payload for automatic polling."""

    authorization: DeviceAuthorizeResponse
    attempt: int
    error: str
    next_interval_seconds: float


@dataclass(frozen=True, slots=True)
class DeviceAuthorizationResult:
    """Result of `authorize_and_poll`."""

    authorization: DeviceAuthorizeResponse
    tokens: DeviceTokenResponse


OpenUrl = Callable[[str, DeviceAuthorizeResponse], None]
PollCallback = Callable[[DevicePollProgress], None]
AsyncOpenUrl = Callable[[str, DeviceAuthorizeResponse], None | Awaitable[None]]
AsyncPollCallback = Callable[[DevicePollProgress], None | Awaitable[None]]


class DeviceAuthenticator:
    """Synchronous automatic device authorization helper.

    If a :class:`sudomimus_connect.TokenStore` is provided, successful polling
    writes the issued token pair before returning. Use that same store with
    :class:`sudomimus_connect.RotatingConnectClient` for later refresh/logout.
    """

    def __init__(
        self,
        client: DeviceClient,
        *,
        store: TokenStore | None = None,
        open_url: OpenUrl | None = None,
        sleep: Callable[[float], None] = time.sleep,
        now: Callable[[], float] = time.monotonic,
    ) -> None:
        self._client = client
        self._store = store
        self._open_url = open_url
        self._sleep = sleep
        self._now = now

    @property
    def client(self) -> DeviceClient:
        return self._client

    @property
    def store(self) -> TokenStore | None:
        return self._store

    def authorize_and_poll(
        self,
        request: DeviceAuthorizeRequest,
        *,
        store: TokenStore | None = None,
        open_url: OpenUrl | None = None,
        on_authorize: Callable[[DeviceAuthorizeResponse], None] | None = None,
        on_poll: PollCallback | None = None,
        poll_timeout_seconds: float | None = None,
    ) -> DeviceAuthorizationResult:
        """Start device authorization, optionally open the browser, then poll."""
        authorization = self._client.device_authorize(request)
        if on_authorize is not None:
            on_authorize(authorization)

        opener = open_url if open_url is not None else self._open_url
        if opener is not None:
            opener(authorization.verificationUriComplete, authorization)

        tokens = self.poll_for_token(
            authorization,
            store=store,
            on_poll=on_poll,
            poll_timeout_seconds=poll_timeout_seconds,
        )
        return DeviceAuthorizationResult(authorization=authorization, tokens=tokens)

    def poll_for_token(
        self,
        authorization: DeviceAuthorizeResponse,
        *,
        store: TokenStore | None = None,
        on_poll: PollCallback | None = None,
        poll_timeout_seconds: float | None = None,
    ) -> DeviceTokenResponse:
        """Poll an existing device authorization session until tokens issue."""
        deadline = self._deadline(authorization, poll_timeout_seconds)
        interval = float(max(1, authorization.interval))
        attempt = 0

        while True:
            if self._now() > deadline:
                raise DevicePollTimeoutError(authorization)

            attempt += 1
            try:
                tokens = self._client.device_token(
                    DeviceTokenRequest(deviceCode=authorization.deviceCode)
                )
                self._persist(tokens, store)
                return tokens
            except DeviceTokenApiError as exc:
                if exc.error not in {"authorization_pending", "slow_down"}:
                    raise
                if exc.error == "slow_down":
                    next_interval = exc.interval if exc.interval is not None else interval + 5
                    interval = float(max(1, next_interval))
                if on_poll is not None:
                    on_poll(
                        DevicePollProgress(
                            authorization=authorization,
                            attempt=attempt,
                            error=str(exc.error),
                            next_interval_seconds=interval,
                        )
                    )
                self._sleep(min(interval, max(0.0, deadline - self._now())))

    def seed(self, tokens: TokenPair) -> None:
        """Persist a token pair into the configured store."""
        self._require_store("seed").save(
            TokenPair(access_token=tokens.access_token, refresh_token=tokens.refresh_token)
        )

    def get_access_token(self) -> str | None:
        """Return the currently-persisted access token, or ``None``."""
        pair = self._require_store("get_access_token").load()
        return pair.access_token if pair is not None else None

    def get_tokens(self) -> TokenPair | None:
        """Return the currently-persisted token pair, or ``None``."""
        return self._require_store("get_tokens").load()

    def _persist(self, tokens: DeviceTokenResponse, store_override: TokenStore | None) -> None:
        store = store_override if store_override is not None else self._store
        if store is None:
            return
        store.save(TokenPair(access_token=tokens.accessToken, refresh_token=tokens.refreshToken))

    def _deadline(
        self,
        authorization: DeviceAuthorizeResponse,
        poll_timeout_seconds: float | None,
    ) -> float:
        expires_at = self._now() + max(1, authorization.expiresIn)
        if poll_timeout_seconds is None:
            return expires_at
        timeout_at = self._now() + max(0.0, poll_timeout_seconds)
        return min(expires_at, timeout_at)

    def _require_store(self, method: str) -> TokenStore:
        if self._store is None:
            raise RuntimeError(f"DeviceAuthenticator.{method}() requires a TokenStore.")
        return self._store


class AsyncDeviceAuthenticator:
    """Asynchronous automatic device authorization helper."""

    def __init__(
        self,
        client: AsyncDeviceClient,
        *,
        store: AsyncTokenStore | None = None,
        open_url: AsyncOpenUrl | None = None,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
        now: Callable[[], float] = time.monotonic,
    ) -> None:
        self._client = client
        self._store = store
        self._open_url = open_url
        self._sleep = sleep
        self._now = now

    @property
    def client(self) -> AsyncDeviceClient:
        return self._client

    @property
    def store(self) -> AsyncTokenStore | None:
        return self._store

    async def authorize_and_poll(
        self,
        request: DeviceAuthorizeRequest,
        *,
        store: AsyncTokenStore | None = None,
        open_url: AsyncOpenUrl | None = None,
        on_authorize: Callable[[DeviceAuthorizeResponse], None | Awaitable[None]] | None = None,
        on_poll: AsyncPollCallback | None = None,
        poll_timeout_seconds: float | None = None,
    ) -> DeviceAuthorizationResult:
        """Start device authorization, optionally open the browser, then poll."""
        authorization = await self._client.device_authorize(request)
        if on_authorize is not None:
            await _maybe_await(on_authorize(authorization))

        opener = open_url if open_url is not None else self._open_url
        if opener is not None:
            await _maybe_await(opener(authorization.verificationUriComplete, authorization))

        tokens = await self.poll_for_token(
            authorization,
            store=store,
            on_poll=on_poll,
            poll_timeout_seconds=poll_timeout_seconds,
        )
        return DeviceAuthorizationResult(authorization=authorization, tokens=tokens)

    async def poll_for_token(
        self,
        authorization: DeviceAuthorizeResponse,
        *,
        store: AsyncTokenStore | None = None,
        on_poll: AsyncPollCallback | None = None,
        poll_timeout_seconds: float | None = None,
    ) -> DeviceTokenResponse:
        """Poll an existing device authorization session until tokens issue."""
        deadline = self._deadline(authorization, poll_timeout_seconds)
        interval = float(max(1, authorization.interval))
        attempt = 0

        while True:
            if self._now() > deadline:
                raise DevicePollTimeoutError(authorization)

            attempt += 1
            try:
                tokens = await self._client.device_token(
                    DeviceTokenRequest(deviceCode=authorization.deviceCode)
                )
                await self._persist(tokens, store)
                return tokens
            except DeviceTokenApiError as exc:
                if exc.error not in {"authorization_pending", "slow_down"}:
                    raise
                if exc.error == "slow_down":
                    next_interval = exc.interval if exc.interval is not None else interval + 5
                    interval = float(max(1, next_interval))
                if on_poll is not None:
                    await _maybe_await(
                        on_poll(
                            DevicePollProgress(
                                authorization=authorization,
                                attempt=attempt,
                                error=str(exc.error),
                                next_interval_seconds=interval,
                            )
                        )
                    )
                await self._sleep(min(interval, max(0.0, deadline - self._now())))

    async def seed(self, tokens: TokenPair) -> None:
        """Persist a token pair into the configured store."""
        await self._require_store("seed").save(
            TokenPair(access_token=tokens.access_token, refresh_token=tokens.refresh_token)
        )

    async def get_access_token(self) -> str | None:
        """Return the currently-persisted access token, or ``None``."""
        pair = await self._require_store("get_access_token").load()
        return pair.access_token if pair is not None else None

    async def get_tokens(self) -> TokenPair | None:
        """Return the currently-persisted token pair, or ``None``."""
        return await self._require_store("get_tokens").load()

    async def _persist(
        self,
        tokens: DeviceTokenResponse,
        store_override: AsyncTokenStore | None,
    ) -> None:
        store = store_override if store_override is not None else self._store
        if store is None:
            return
        await store.save(
            TokenPair(access_token=tokens.accessToken, refresh_token=tokens.refreshToken)
        )

    def _deadline(
        self,
        authorization: DeviceAuthorizeResponse,
        poll_timeout_seconds: float | None,
    ) -> float:
        expires_at = self._now() + max(1, authorization.expiresIn)
        if poll_timeout_seconds is None:
            return expires_at
        timeout_at = self._now() + max(0.0, poll_timeout_seconds)
        return min(expires_at, timeout_at)

    def _require_store(self, method: str) -> AsyncTokenStore:
        if self._store is None:
            raise RuntimeError(f"AsyncDeviceAuthenticator.{method}() requires an AsyncTokenStore.")
        return self._store


async def _maybe_await(value: None | Awaitable[None]) -> None:
    if inspect.isawaitable(value):
        await value
