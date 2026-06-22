"""Refresh-token rotation wrappers around :class:`SessionClient`."""

from __future__ import annotations

import asyncio
import threading
from concurrent.futures import Future
from typing import TYPE_CHECKING

from ._generated.models import LogoutRequest, RefreshRequest
from .errors import SessionConfigError
from .token_store import AsyncTokenStore, TokenPair, TokenStore

if TYPE_CHECKING:
    from .async_client import AsyncSessionClient
    from .client import SessionClient


class RotatingSessionClient:
    """Synchronous rotation wrapper."""

    def __init__(self, client: SessionClient, store: TokenStore) -> None:
        self._client = client
        self._store = store
        self._refresh_lock = threading.Lock()
        self._in_flight: Future[str] | None = None

    @property
    def client(self) -> SessionClient:
        return self._client

    @property
    def store(self) -> TokenStore:
        return self._store

    def seed(self, tokens: TokenPair) -> None:
        """Persist the initial pair returned by an ordinary login flow."""
        self._store.save(TokenPair(access_token=tokens.access_token, refresh_token=tokens.refresh_token))

    def get_access_token(self) -> str | None:
        """Return the currently-persisted access token, or ``None``."""
        pair = self._store.load()
        return pair.access_token if pair is not None else None

    def get_tokens(self) -> TokenPair | None:
        """Return the currently-persisted token pair, or ``None``."""
        return self._store.load()

    def refresh(self) -> str:
        """Rotate the refresh token and persist the new pair."""
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
        """Best-effort revoke server-side and clear the local store."""
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
            raise SessionConfigError(
                "RotatingSessionClient.refresh() called before seed() — no token pair to rotate."
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


class AsyncRotatingSessionClient:
    """Asynchronous rotation wrapper."""

    def __init__(self, client: AsyncSessionClient, store: AsyncTokenStore) -> None:
        self._client = client
        self._store = store
        self._refresh_lock = asyncio.Lock()
        self._in_flight: asyncio.Task[str] | None = None

    @property
    def client(self) -> AsyncSessionClient:
        return self._client

    @property
    def store(self) -> AsyncTokenStore:
        return self._store

    async def seed(self, tokens: TokenPair) -> None:
        """Persist the initial pair returned by an ordinary login flow."""
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
        """Rotate the refresh token."""
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
            raise SessionConfigError(
                "AsyncRotatingSessionClient.refresh() called before seed() "
                "— no token pair to rotate."
            )
        response = await self._client.refresh(RefreshRequest(refreshToken=pair.refresh_token))
        await self._store.save(
            TokenPair(access_token=response.accessToken, refresh_token=response.refreshToken)
        )
        return response.accessToken
