"""Sudomimus Token SDK.

Parse and verify Sudomimus access and refresh JWTs. Verification covers
structural integrity, expected media type (``typ``), audience presence,
expiration, and the RS256 signature against a caller-supplied public key.
"""

from __future__ import annotations

from ._codec import create_jwt, decode_base64url, encode_base64url, sign_rs256, verify_rs256
from .errors import TokenError, TokenErrorCode
from .id_token import IdToken, parse_id_token, verify_id_token
from .jwks import rsa_jwk_to_pem
from .models import (
    AccessTokenBody,
    AccessTokenHeader,
    IdTokenBody,
    IdTokenHeader,
    JwtHeader,
    RefreshTokenBody,
    RefreshTokenHeader,
    UserInfoResponse,
)
from .parser import parse_access_token, parse_refresh_token, peek_body, peek_header
from .token import AccessToken, JwtToken, RefreshToken
from .verifier import (
    ACCESS_TOKEN_TYPE,
    REFRESH_TOKEN_TYPE,
    AsyncPublicKeyResolver,
    AsyncTokenVerifier,
    PublicKeyResolver,
    TokenVerifier,
)

__all__ = [
    "ACCESS_TOKEN_TYPE",
    "REFRESH_TOKEN_TYPE",
    "AccessToken",
    "AccessTokenBody",
    "AccessTokenHeader",
    "AsyncPublicKeyResolver",
    "AsyncTokenVerifier",
    "IdToken",
    "IdTokenBody",
    "IdTokenHeader",
    "JwtHeader",
    "JwtToken",
    "PublicKeyResolver",
    "RefreshToken",
    "RefreshTokenBody",
    "RefreshTokenHeader",
    "TokenError",
    "TokenErrorCode",
    "TokenVerifier",
    "UserInfoResponse",
    "create_jwt",
    "decode_base64url",
    "encode_base64url",
    "parse_access_token",
    "parse_id_token",
    "parse_refresh_token",
    "peek_header",
    "peek_body",
    "sign_rs256",
    "verify_id_token",
    "verify_rs256",
    "rsa_jwk_to_pem",
]
