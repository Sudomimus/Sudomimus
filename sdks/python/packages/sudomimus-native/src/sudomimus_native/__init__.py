"""Sudomimus Native SDK.

Native client entry point for the Sudomimus authentication platform.
"""

from __future__ import annotations

from dataclasses import dataclass

import httpx

from ._generated.models import (
    Error as NativeError,
)
from ._generated.models import (
    StatusPollRequest,
    StatusPollResponse,
)

__all__ = [
    "NativeClient",
    "NativeClientOptions",
    "NativeError",
    "StatusPollRequest",
    "StatusPollResponse",
]


@dataclass(slots=True)
class NativeClientOptions:
    base_url: str


class NativeClient:
    """Client for the Sudomimus Native API."""

    def __init__(
        self,
        *,
        base_url: str,
        transport: httpx.Client | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._transport = transport

    @property
    def base_url(self) -> str:
        return self._base_url
