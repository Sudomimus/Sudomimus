"""Sudomimus Connect SDK.

Token-exchange client for the Sudomimus authentication platform: establish an
inquiry, poll its status, redeem it for application tokens, refresh access
tokens, fetch localized application metadata, introspect a session's
revocation status, and revoke sessions (a single session via ``/logout`` or
every session of an account via ``/revoke-all``). Includes client-auth JWT
signing for ``/establish`` and ``/revoke-all``, and token verification (via
``sudomimus-token``).
"""

from __future__ import annotations

from ._generated.models import (
    AuthenticationRuleConstraint,
    AuthenticationRuleEmailVerificationPayload,
    AuthenticationRulePasskeyPayload,
    EstablishRequest,
    EstablishResponse,
    HealthResponse,
    InfoRequest,
    InfoResponse,
    IntrospectRequest,
    IntrospectResponse,
    LogoutRequest,
    LogoutResponse,
    RealizeRuleConstraint,
    RealizeRuleEmailPayload,
    RedeemRequest,
    RedeemResponse,
    RefreshRequest,
    RefreshResponse,
    ReturnMethodCallback,
    ReturnMethodDeclaration,
    ReturnMethodReveal,
    ReturnMethodStatusPoll,
    RevokeAllRequest,
    RevokeAllResponse,
    StatusPollPendingResponse,
    StatusPollRealizedResponse,
    StatusPollRequest,
    StatusPollResponse,
)
from ._generated.models import Error as ConnectError
from .async_client import AsyncConnectClient
from .client import ConnectClient
from .client_auth import (
    ClientAuthSigner,
    ConnectClientAuth,
    ConnectClientAuthWithKey,
    ConnectClientAuthWithSigner,
    build_establish_client_jwt_claims,
    sha256_base64,
    sign_establish_client_jwt,
)
from .constants import (
    CLIENT_JWT_AUDIENCE,
    CLIENT_JWT_AUTH_SCHEME,
    CLIENT_JWT_DEFAULT_LIFETIME_SECONDS,
    CLIENT_JWT_MAX_LIFETIME_SECONDS,
    DEFAULT_PUBLIC_KEY_LOCALE,
    PRODUCTION_BASE_URL,
)
from .errors import ConnectApiError, ConnectConfigError
from .rotating_client import AsyncRotatingConnectClient, RotatingConnectClient
from .token_store import (
    AsyncInMemoryTokenStore,
    AsyncTokenStore,
    InMemoryTokenStore,
    TokenPair,
    TokenStore,
)

__all__ = [
    "CLIENT_JWT_AUDIENCE",
    "CLIENT_JWT_AUTH_SCHEME",
    "CLIENT_JWT_DEFAULT_LIFETIME_SECONDS",
    "CLIENT_JWT_MAX_LIFETIME_SECONDS",
    "DEFAULT_PUBLIC_KEY_LOCALE",
    "PRODUCTION_BASE_URL",
    "AsyncConnectClient",
    "AsyncInMemoryTokenStore",
    "AsyncRotatingConnectClient",
    "AsyncTokenStore",
    "AuthenticationRuleConstraint",
    "AuthenticationRuleEmailVerificationPayload",
    "AuthenticationRulePasskeyPayload",
    "ClientAuthSigner",
    "ConnectApiError",
    "ConnectClient",
    "ConnectClientAuth",
    "ConnectClientAuthWithKey",
    "ConnectClientAuthWithSigner",
    "ConnectConfigError",
    "ConnectError",
    "EstablishRequest",
    "EstablishResponse",
    "HealthResponse",
    "InMemoryTokenStore",
    "InfoRequest",
    "InfoResponse",
    "IntrospectRequest",
    "IntrospectResponse",
    "LogoutRequest",
    "LogoutResponse",
    "RealizeRuleConstraint",
    "RealizeRuleEmailPayload",
    "RedeemRequest",
    "RedeemResponse",
    "RefreshRequest",
    "RefreshResponse",
    "ReturnMethodCallback",
    "ReturnMethodDeclaration",
    "ReturnMethodReveal",
    "ReturnMethodStatusPoll",
    "RevokeAllRequest",
    "RevokeAllResponse",
    "RotatingConnectClient",
    "StatusPollPendingResponse",
    "StatusPollRealizedResponse",
    "StatusPollRequest",
    "StatusPollResponse",
    "TokenPair",
    "TokenStore",
    "build_establish_client_jwt_claims",
    "sha256_base64",
    "sign_establish_client_jwt",
]
