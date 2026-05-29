"""Refresh-token rotation wrappers around :class:`ConnectClient`.

These classes carry out the OAuth 2.1 BCP §4.14.2 strict refresh-token
rotation contract correctly: :meth:`RotatingConnectClient.refresh` reads
the current refresh token from the configured :class:`TokenStore`, calls
``/refresh``, and atomically writes the rotated pair back BEFORE
returning. Callers never see an intermediate state where the old refresh
token has been consumed but the new one is not yet persisted.

Concurrent ``refresh`` calls on the SAME wrapper instance coalesce onto a
single in-flight ``/refresh`` (in-process de-dupe). This avoids tripping
``RefreshTokenRotationRaceLost`` when many requests fire at once and the
access token has just expired. CROSS-process races are still the
caller's responsibility — back the :class:`TokenStore` with an external
lock (Redis ``SETNX``, a DB row lock, ...) if you run multiple
instances.

Initial population of the store happens via :meth:`seed` — call it once
with the pair returned by ``/redeem``.

Both sync and async variants are provided. They are otherwise
behaviourally identical.
"""

from __future__ import annotations

import asyncio
import threading
from concurrent.futures import Future
from typing import TYPE_CHECKING

from ._generated.models import LogoutRequest, RefreshRequest
from .errors import ConnectConfigError
from .token_store import AsyncTokenStore, TokenPair, TokenStore

if TYPE_CHECKING:
    from .async_client import AsyncConnectClient
    from .client import ConnectClient


class RotatingConnectClient:
    """Synchronous rotation wrapper.

    Compose with a :class:`~sudomimus_connect.ConnectClient` and a
    :class:`~sudomimus_connect.token_store.TokenStore` (typically
    :class:`~sudomimus_connect.token_store.InMemoryTokenStore` for
    development; back with persistent storage in production).
    """

    def __init__(self, client: ConnectClient, store: TokenStore) -> None:
        self._client = client
        self._store = store
        self._refresh_lock = threading.Lock()
        self._in_flight: Future[str] | None = None

    @property
    def client(self) -> ConnectClient:
        """Underlying low-level client — for ``/establish`` / ``/redeem`` / etc."""
        return self._client

    @property
    def store(self) -> TokenStore:
        """The token store this wrapper owns."""
        return self._store

    def seed(self, tokens: TokenPair) -> None:
        """Persist the initial pair returned by ``/redeem``.

        Call once, right after a successful redeem, before any other
        method on this wrapper.
        """
        self._store.save(
            TokenPair(access_token=tokens.access_token, refresh_token=tokens.refresh_token)
        )

    def get_access_token(self) -> str | None:
        """Return the currently-persisted access token, or ``None``."""
        pair = self._store.load()
        return pair.access_token if pair is not None else None

    def get_tokens(self) -> TokenPair | None:
        """Return the currently-persisted token pair, or ``None``."""
        return self._store.load()

    def refresh(self) -> str:
        """Rotate the refresh token.

        Reads the current pair from the store, calls ``/refresh``,
        persists the new pair, and returns the new access token.

        Raises :class:`~sudomimus_connect.errors.ConnectConfigError` if
        the store is empty. Surfaces the underlying
        :class:`~sudomimus_connect.errors.ConnectApiError` (with reasons
        like ``RefreshTokenFamilyCompromised`` /
        ``RefreshTokenRotationRaceLost``) on rotation failure — in those
        cases the family is server-side revoked and the caller MUST
        re-authenticate via ``/establish``.

        Concurrent calls on the same instance share one in-flight
        refresh.
        """
        with self._refresh_lock:
            if self._in_flight is not None:
                future = self._in_flight
                owner = False
            else:
                future = Future()
                self._in_flight = future
                owner = True

        if not owner:
            return future.result()

        try:
            result = self._perform_refresh()
        except BaseException as exc:
            future.set_exception(exc)
            self._clear_in_flight(future)
            raise

        future.set_result(result)
        self._clear_in_flight(future)
        return result

    def logout(self) -> None:
        """Best-effort revoke the session server-side and clear the store.

        Idempotent: if the store is empty this is a no-op. If the
        server-side revoke fails, the local store is still cleared.
        """
        pair = self._store.load()
        if pair is None:
            return
        try:
            self._client.logout(LogoutRequest(refreshToken=pair.refresh_token))
        finally:
            self._store.clear()

    def _perform_refresh(self) -> str:
        pair = self._store.load()
        if pair is None:
            raise ConnectConfigError(
                "RotatingConnectClient.refresh() called before seed() — no token pair to rotate."
            )
        response = self._client.refresh(RefreshRequest(refreshToken=pair.refresh_token))
        self._store.save(
            TokenPair(access_token=response.accessToken, refresh_token=response.refreshToken)
        )
        return response.accessToken

    def _clear_in_flight(self, future: Future[str]) -> None:
        with self._refresh_lock:
            if self._in_flight is future:
                self._in_flight = None


class AsyncRotatingConnectClient:
    """Asynchronous rotation wrapper.

    Compose with an :class:`~sudomimus_connect.AsyncConnectClient` and an
    :class:`~sudomimus_connect.token_store.AsyncTokenStore` (typically
    :class:`~sudomimus_connect.token_store.AsyncInMemoryTokenStore` for
    development).
    """

    def __init__(self, client: AsyncConnectClient, store: AsyncTokenStore) -> None:
        self._client = client
        self._store = store
        self._refresh_lock = asyncio.Lock()
        self._in_flight: asyncio.Task[str] | None = None

    @property
    def client(self) -> AsyncConnectClient:
        return self._client

    @property
    def store(self) -> AsyncTokenStore:
        return self._store

    async def seed(self, tokens: TokenPair) -> None:
        """Persist the initial pair returned by ``/redeem``."""
        await self._store.save(
            TokenPair(access_token=tokens.access_token, refresh_token=tokens.refresh_token)
        )

    async def get_access_token(self) -> str | None:
        """Return the currently-persisted access token, or ``None``."""
        pair = await self._store.load()
        return pair.access_token if pair is not None else None

    async def get_tokens(self) -> TokenPair | None:
        """Return the currently-persisted token pair, or ``None``."""
        return await self._store.load()

    async def refresh(self) -> str:
        """Rotate the refresh token. See :meth:`RotatingConnectClient.refresh`."""
        async with self._refresh_lock:
            task = self._in_flight
            if task is None:
                task = asyncio.create_task(self._perform_refresh())
                self._in_flight = task

        try:
            return await task
        finally:
            async with self._refresh_lock:
                if self._in_flight is task:
                    self._in_flight = None

    async def logout(self) -> None:
        """Best-effort revoke server-side and clear the local store."""
        pair = await self._store.load()
        if pair is None:
            return
        try:
            await self._client.logout(LogoutRequest(refreshToken=pair.refresh_token))
        finally:
            await self._store.clear()

    async def _perform_refresh(self) -> str:
        pair = await self._store.load()
        if pair is None:
            raise ConnectConfigError(
                "AsyncRotatingConnectClient.refresh() called before seed() "
                "— no token pair to rotate."
            )
        response = await self._client.refresh(RefreshRequest(refreshToken=pair.refresh_token))
        await self._store.save(
            TokenPair(access_token=response.accessToken, refresh_token=response.refreshToken)
        )
        return response.accessToken
