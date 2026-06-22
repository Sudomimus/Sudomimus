"""Per-session token persistence contracts for Session refresh rotation."""

from __future__ import annotations

import asyncio
import threading
from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True)
class TokenPair:
    """A Sudomimus access/refresh token pair."""

    access_token: str
    refresh_token: str


class TokenStore(Protocol):
    """Synchronous per-session token persistence contract."""

    def load(self) -> TokenPair | None: ...

    def save(self, tokens: TokenPair) -> None: ...

    def clear(self) -> None: ...


class AsyncTokenStore(Protocol):
    """Asynchronous per-session token persistence contract."""

    async def load(self) -> TokenPair | None: ...

    async def save(self, tokens: TokenPair) -> None: ...

    async def clear(self) -> None: ...


class InMemoryTokenStore:
    """Thread-safe in-memory single-session token store."""

    def __init__(self, initial: TokenPair | None = None) -> None:
        self._lock = threading.Lock()
        self._pair: TokenPair | None = initial

    def load(self) -> TokenPair | None:
        with self._lock:
            return self._pair

    def save(self, tokens: TokenPair) -> None:
        with self._lock:
            self._pair = TokenPair(
                access_token=tokens.access_token,
                refresh_token=tokens.refresh_token,
            )

    def clear(self) -> None:
        with self._lock:
            self._pair = None


class AsyncInMemoryTokenStore:
    """Async in-memory single-session token store."""

    def __init__(self, initial: TokenPair | None = None) -> None:
        self._lock = asyncio.Lock()
        self._pair: TokenPair | None = initial

    async def load(self) -> TokenPair | None:
        async with self._lock:
            return self._pair

    async def save(self, tokens: TokenPair) -> None:
        async with self._lock:
            self._pair = TokenPair(
                access_token=tokens.access_token,
                refresh_token=tokens.refresh_token,
            )

    async def clear(self) -> None:
        async with self._lock:
            self._pair = None
