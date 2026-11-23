"""High-level helpers for automatic Device API polling."""

from __future__ import annotations

import asyncio
import inspect
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import TYPE_CHECKING

from sudomimus_session import AsyncTokenStore, TokenPair, TokenStore

from ._generated.models import (
    DeviceAuthorizeRequest,
    DeviceTokenRequest,
    DeviceTokenResponse,
)
from .errors import DevicePollTimeoutError, DeviceTokenApiError
from .models import DeviceAuthorizeResponse

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


@dataclass(slots=True)
class _PollSchedule:
    authorization: DeviceAuthorizeResponse
    deadline: float
    next_poll_at: float
    interval: float
    attempt: int = 0

    @classmethod
    def start(
        cls,
        authorization: DeviceAuthorizeResponse,
        started_at: float,
        timeout: float | None,
    ) -> _PollSchedule:
        lifetime = float(authorization.expiresIn)
        if timeout is not None:
            lifetime = min(lifetime, timeout)
        interval = float(authorization.interval)
        return cls(authorization, started_at + lifetime, started_at + interval, interval)

    def wait_seconds(self, now: float) -> float:
        return max(0.0, min(self.deadline, self.next_poll_at) - now)

    def begin_poll(self, now: float) -> None:
        if now >= self.deadline:
            raise DevicePollTimeoutError(self.authorization)
        self.attempt += 1

    def retry(self, error: DeviceTokenApiError, now: float) -> DevicePollProgress | None:
        if error.error not in {"authorization_pending", "slow_down"}:
            return None
        if error.error == "slow_down":
            self.interval = float(error.interval) if error.interval else self.interval + 5
        self.next_poll_at = now + self.interval
        return DevicePollProgress(
            authorization=self.authorization,
            attempt=self.attempt,
            error=str(error.error),
            next_interval_seconds=self.interval,
        )


class DeviceAuthenticator:
    """Synchronous automatic device authorization helper.

    If a :class:`sudomimus_session.TokenStore` is provided, successful polling
    writes the issued token pair before returning. Use that same store with
    :class:`sudomimus_session.RotatingSessionClient` for later refresh/logout.
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
        schedule = _PollSchedule.start(authorization, self._now(), poll_timeout_seconds)
        if on_authorize is not None:
            on_authorize(authorization)

        opener = open_url if open_url is not None else self._open_url
        if opener is not None:
            opener(str(authorization.verificationUriComplete), authorization)

        tokens = self._poll_for_token(schedule, store, on_poll)
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
        schedule = _PollSchedule.start(authorization, self._now(), poll_timeout_seconds)
        return self._poll_for_token(schedule, store, on_poll)

    def _poll_for_token(
        self,
        schedule: _PollSchedule,
        store: TokenStore | None,
        on_poll: PollCallback | None,
    ) -> DeviceTokenResponse:
        request = DeviceTokenRequest(deviceCode=schedule.authorization.deviceCode)
        while True:
            wait = schedule.wait_seconds(self._now())
            if wait > 0:
                self._sleep(wait)
            schedule.begin_poll(self._now())

            try:
                tokens = self._client.device_token(request)
            except DeviceTokenApiError as error:
                progress = schedule.retry(error, self._now())
                if progress is None:
                    raise
                if on_poll is not None:
                    on_poll(progress)
                continue

            self._persist(tokens, store)
            return tokens

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
        schedule = _PollSchedule.start(authorization, self._now(), poll_timeout_seconds)
        if on_authorize is not None:
            await _maybe_await(on_authorize(authorization))

        opener = open_url if open_url is not None else self._open_url
        if opener is not None:
            await _maybe_await(opener(str(authorization.verificationUriComplete), authorization))

        tokens = await self._poll_for_token(schedule, store, on_poll)
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
        schedule = _PollSchedule.start(authorization, self._now(), poll_timeout_seconds)
        return await self._poll_for_token(schedule, store, on_poll)

    async def _poll_for_token(
        self,
        schedule: _PollSchedule,
        store: AsyncTokenStore | None,
        on_poll: AsyncPollCallback | None,
    ) -> DeviceTokenResponse:
        request = DeviceTokenRequest(deviceCode=schedule.authorization.deviceCode)
        while True:
            wait = schedule.wait_seconds(self._now())
            if wait > 0:
                await self._sleep(wait)
            schedule.begin_poll(self._now())

            try:
                tokens = await self._client.device_token(request)
            except DeviceTokenApiError as error:
                progress = schedule.retry(error, self._now())
                if progress is None:
                    raise
                if on_poll is not None:
                    await _maybe_await(on_poll(progress))
                continue

            await self._persist(tokens, store)
            return tokens

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

    def _require_store(self, method: str) -> AsyncTokenStore:
        if self._store is None:
            raise RuntimeError(f"AsyncDeviceAuthenticator.{method}() requires an AsyncTokenStore.")
        return self._store


async def _maybe_await(value: None | Awaitable[None]) -> None:
    if inspect.isawaitable(value):
        await value
