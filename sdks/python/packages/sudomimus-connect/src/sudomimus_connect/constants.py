"""Connect client constants."""

from __future__ import annotations

PRODUCTION_BASE_URL = "https://connect-api.sudomimus.com"

DEFAULT_PUBLIC_KEY_LOCALE = "en-US"

CLIENT_JWT_AUDIENCE = "sudomimus-connect"
CLIENT_JWT_AUTH_SCHEME = "SudomimusClientJWT"
CLIENT_JWT_DEFAULT_LIFETIME_SECONDS = 30
CLIENT_JWT_MAX_LIFETIME_SECONDS = 60
