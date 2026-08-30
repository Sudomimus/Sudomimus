"""Sudomimus Native SDK.

Direct-issue client for native callers: exchange a Steam Web API auth ticket
or an access-key credential for application access and refresh tokens in a
single round trip.
"""

from __future__ import annotations

from ._generated.models import (
    ClaimRequirementStateView,
    ClaimsStateView,
    CreateErrandRequest,
    CreateErrandResponse,
    DirectIssueAccessKeyRequest,
    DirectIssueAccessKeyResponse,
    DirectIssuePublicKeyRequest,
    DirectIssueSteamTicketRequest,
    DirectIssueSteamTicketResponse,
    ErrandHandoff,
    ErrandStatusResponse,
    Requirement,
    State,
)
from ._generated.models import Error as NativeError
from ._generated.models import (
    Status1 as Status,
)
from .async_client import AsyncNativeClient
from .client import NativeClient
from .constants import PRODUCTION_BASE_URL, STEAM_TICKET_IDENTITY
from .errors import NativeApiError
from .public_key_assertion import (
    PUBLIC_KEY_ASSERTION_AUDIENCE,
    PUBLIC_KEY_ASSERTION_TYPE,
    PublicKeyCredential,
    SignedPublicKeyRequest,
    sign_public_key_request,
)

__all__ = [
    "PRODUCTION_BASE_URL",
    "STEAM_TICKET_IDENTITY",
    "AsyncNativeClient",
    "ClaimsStateView",
    "ClaimRequirementStateView",
    "CreateErrandRequest",
    "CreateErrandResponse",
    "DirectIssueAccessKeyRequest",
    "DirectIssueAccessKeyResponse",
    "DirectIssuePublicKeyRequest",
    "DirectIssueSteamTicketRequest",
    "DirectIssueSteamTicketResponse",
    "ErrandHandoff",
    "ErrandStatusResponse",
    "NativeApiError",
    "NativeClient",
    "NativeError",
    "PUBLIC_KEY_ASSERTION_AUDIENCE",
    "PUBLIC_KEY_ASSERTION_TYPE",
    "PublicKeyCredential",
    "Requirement",
    "State",
    "Status",
    "SignedPublicKeyRequest",
    "sign_public_key_request",
]
