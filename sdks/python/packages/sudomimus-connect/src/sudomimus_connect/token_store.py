"""Token-store contract + in-memory defaults.

The Connect API does OAuth 2.1 BCP §4.14.2 strict refresh-token rotation:
every ``/refresh`` returns a NEW refresh token and invalidates the one that
was presented. Re-presenting the old refresh token (or losing the rotation
race to a concurrent caller) is treated as compromise and revokes the
entire refresh-token family.

A :class:`TokenStore` is the per-session persistence boundary that lets
:class:`~sudomimus_connect.rotating_client.RotatingConnectClient` carry
out a rotation safely. Implementations MUST:

1. Return the most recently written pair from ``load``.
2. Atomically replace the stored pair on ``save`` — partial writes that
   leave only the new access token without the new refresh token will
   desynchronize the caller from the server.
3. Be safe to call from multiple concurrent code paths within a single
   process. Cross-process serialization (e.g. Redis lock around
   ``load -> /refresh -> save``) is the caller's responsibility.

One store instance represents ONE session — typically one logged-in user
on one device. Servers serving many users instantiate one store per
session, backed by whatever per-session storage already exists (database
row, Redis hash, cookie jar, ...).

Both sync and async variants are provided so callers using
:class:`~sudomimus_connect.ConnectClient` or
:class:`~sudomimus_connect.AsyncConnectClient` can pick a matching store
without bridging event loops.
"""

from __future__ import annotations

import asyncio
import threading
from dataclasses import dataclass
from typing import Protocol, runtime_checkable


@dataclass(frozen=True, slots=True)
class TokenPair:
    """A pair of Connect-issued tokens.

    Shape matches what ``/redeem`` and ``/refresh`` return — persist both
    verbatim so the next rotation can present the current refresh token.
    """

    access_token: str
    refresh_token: str


@runtime_checkable
class TokenStore(Protocol):
    """Synchronous per-session token persistence contract."""

    def load(self) -> TokenPair | None:
        """Read the current pair, or ``None`` when no session is loaded."""
        ...

    def save(self, tokens: TokenPair) -> None:
        """Atomically overwrite the stored pair."""
        ...

    def clear(self) -> None:
        """Forget the pair (e.g. on ``/logout`` or family compromise)."""
        ...


@runtime_checkable
class AsyncTokenStore(Protocol):
    """Asynchronous per-session token persistence contract.

    The methods are coroutines so async-native stores (Redis, async DB
    drivers, etc.) can be plugged in without thread-pool detours.
    """

    async def load(self) -> TokenPair | None: ...

    async def save(self, tokens: TokenPair) -> None: ...

    async def clear(self) -> None: ...


class InMemoryTokenStore:
    """In-memory single-session store guarded by :class:`threading.Lock`.

    Suitable for development, tests, and short-lived processes. NOT
    suitable for a multi-process server — each process holds an
    independent copy and a refresh-token rotation in one process will
    not be visible to the others (which will then race and trip family
    compromise).
    """

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
    """In-memory single-session store guarded by :class:`asyncio.Lock`.

    Mirror of :class:`InMemoryTokenStore` for async callers. Same caveat:
    fine for tests and single-process apps, unsafe for multi-process
    deployments.
    """

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
