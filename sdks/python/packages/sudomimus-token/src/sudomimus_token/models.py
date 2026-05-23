"""Claim models for Sudomimus access and refresh tokens.

Standard envelope claims (``iss``, ``aud``, ``iat``, ``exp``, ``jti``,
``kty``, ``sub``) live in the JWT *header*; the body carries only the
application-specific claims. This mirrors ``@sudomimus/token`` and the C#
``Sudomimus.Token`` package.
"""

from __future__ import annotations

from pydantic import BaseModel


class JwtHeader(BaseModel):
    """Envelope claims carried in the JWT header segment."""

    alg: str | None = None
    typ: str | None = None
    iss: str | None = None
    aud: str | None = None
    iat: int | None = None
    exp: int | None = None
    nbf: int | None = None
    jti: str | None = None
    sub: str | None = None
    kty: str | None = None
    ver: str | None = None


class AccessTokenBody(BaseModel):
    """Body claims carried in a Sudomimus access token."""

    accountIdentifier: str
    firstName: str
    lastName: str | None = None


class RefreshTokenBody(BaseModel):
    """Body claims carried in a Sudomimus refresh token."""

    accountIdentifier: str
