"""Sudomimus Token SDK.

Parse and verify Sudomimus access and refresh JWTs. Verification covers
structural integrity, expected key type (``kty``), audience presence,
expiration, and the RS256 signature against a caller-supplied public key.
"""

from __future__ import annotations

from ._codec import create_jwt, decode_base64url, encode_base64url, sign_rs256, verify_rs256
from .errors import TokenError, TokenErrorCode
from .models import AccessTokenBody, JwtHeader, RefreshTokenBody
from .parser import parse_access_token, parse_refresh_token, peek_header
from .token import AccessToken, JwtToken, RefreshToken
from .verifier import (
    ACCESS_TOKEN_KEY_TYPE,
    REFRESH_TOKEN_KEY_TYPE,
    AsyncPublicKeyResolver,
    AsyncTokenVerifier,
    PublicKeyResolver,
    TokenVerifier,
)

__all__ = [
    "ACCESS_TOKEN_KEY_TYPE",
    "REFRESH_TOKEN_KEY_TYPE",
    "AccessToken",
    "AccessTokenBody",
    "AsyncPublicKeyResolver",
    "AsyncTokenVerifier",
    "JwtHeader",
    "JwtToken",
    "PublicKeyResolver",
    "RefreshToken",
    "RefreshTokenBody",
    "TokenError",
    "TokenErrorCode",
    "TokenVerifier",
    "create_jwt",
    "decode_base64url",
    "encode_base64url",
    "parse_access_token",
    "parse_refresh_token",
    "peek_header",
    "sign_rs256",
    "verify_rs256",
]
