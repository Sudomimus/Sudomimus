"""Sudomimus Device SDK.

Public-client device authorization for the Sudomimus authentication platform.
Start a device session, show the user code / browser URL, then poll until an
ordinary Sudomimus application token pair is issued.
"""

from __future__ import annotations

from ._generated.models import (
    ClaimRequirementStateView,
    ClaimsStateView,
    DeviceAuthorizeRequest,
    DeviceAuthorizeResponse,
    DeviceTokenError,
    DeviceTokenRequest,
    DeviceTokenResponse,
    HealthResponse,
    Requirement,
    State,
)
from ._generated.models import Error as DeviceError
from .async_client import AsyncDeviceClient
from .authenticator import (
    AsyncDeviceAuthenticator,
    DeviceAuthorizationResult,
    DeviceAuthenticator,
    DevicePollProgress,
)
from .client import DeviceClient
from .constants import PRODUCTION_BASE_URL
from .errors import DeviceApiError, DevicePollTimeoutError, DeviceTokenApiError

__all__ = [
    "PRODUCTION_BASE_URL",
    "AsyncDeviceAuthenticator",
    "AsyncDeviceClient",
    "ClaimRequirementStateView",
    "ClaimsStateView",
    "DeviceApiError",
    "DeviceAuthorizationResult",
    "DeviceAuthenticator",
    "DeviceAuthorizeRequest",
    "DeviceAuthorizeResponse",
    "DeviceClient",
    "DeviceError",
    "DevicePollProgress",
    "DevicePollTimeoutError",
    "DeviceTokenApiError",
    "DeviceTokenError",
    "DeviceTokenRequest",
    "DeviceTokenResponse",
    "HealthResponse",
    "Requirement",
    "State",
]
