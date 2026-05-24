"""Sudomimus Native SDK.

Direct-issue client for native callers: exchange a Steam Web API auth ticket
or an access-key credential for application access and refresh tokens in a
single round trip.
"""

from __future__ import annotations

from ._generated.models import (
    DirectIssueAccessKeyRequest,
    DirectIssueAccessKeyResponse,
    DirectIssueSteamTicketRequest,
    DirectIssueSteamTicketResponse,
)
from ._generated.models import Error as NativeError
from .async_client import AsyncNativeClient
from .client import NativeClient
from .constants import PRODUCTION_BASE_URL, STEAM_TICKET_IDENTITY
from .errors import NativeApiError

__all__ = [
    "PRODUCTION_BASE_URL",
    "STEAM_TICKET_IDENTITY",
    "AsyncNativeClient",
    "DirectIssueAccessKeyRequest",
    "DirectIssueAccessKeyResponse",
    "DirectIssueSteamTicketRequest",
    "DirectIssueSteamTicketResponse",
    "NativeApiError",
    "NativeClient",
    "NativeError",
]
