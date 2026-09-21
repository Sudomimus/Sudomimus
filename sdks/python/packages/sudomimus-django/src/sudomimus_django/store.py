"""Server-side credential storage contract for Django integrations."""

from __future__ import annotations

import time
from collections.abc import Callable
from threading import Lock
from typing import Protocol, TypeVar

_T = TypeVar("_T")
Credential = dict[str, str | int]


class DjangoCredentialStore(Protocol):
    """Production implementations must serialize updates across all workers."""

    def put(self, key: str, value: Credential, ttl_seconds: int) -> None: ...

    def update(
        self, key: str, action: Callable[[Credential | None], tuple[Credential | None, _T]]
    ) -> _T: ...


class MemoryDjangoCredentialStore:
    """Single-process store for development and tests only."""

    def __init__(self) -> None:
        self._values: dict[str, tuple[Credential, float]] = {}
        self._lock = Lock()

    def put(self, key: str, value: Credential, ttl_seconds: int) -> None:
        with self._lock:
            self._values[key] = (value, time.time() + ttl_seconds)

    def update(
        self, key: str, action: Callable[[Credential | None], tuple[Credential | None, _T]]
    ) -> _T:
        with self._lock:
            stored = self._values.get(key)
            current = stored[0].copy() if stored and stored[1] > time.time() else None
            value, result = action(current)
            if value is not None and stored and stored[1] > time.time():
                self._values[key] = (value, stored[1])
            else:
                self._values.pop(key, None)
            return result
