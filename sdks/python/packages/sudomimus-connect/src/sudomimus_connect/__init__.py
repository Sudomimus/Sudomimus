"""Sudomimus Connect SDK.

Token exchange client for the Sudomimus authentication platform.
"""

from __future__ import annotations

from dataclasses import dataclass

import httpx

from ._generated.models import (
    Error as ConnectError,
)
from ._generated.models import (
    EstablishRequest,
    EstablishResponse,
    RedeemRequest,
    RefreshRequest,
    TokenPair,
)

__all__ = [
    "ConnectClient",
    "ConnectClientOptions",
    "ConnectError",
    "EstablishRequest",
    "EstablishResponse",
    "RedeemRequest",
    "RefreshRequest",
    "TokenPair",
]


@dataclass(slots=True)
class ConnectClientOptions:
    base_url: str


class ConnectClient:
    """Client for the Sudomimus Connect API."""

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
