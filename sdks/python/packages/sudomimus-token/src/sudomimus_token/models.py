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
    """Body claims carried in a Sudomimus access token.

    ``subject`` is the application-visible **sector subject** (also the
    OIDC ``sub``) — the value an application keys its users on. The raw
    internal account identifier never appears in a token. Opaque: never
    parse or format-validate it.
    """

    subject: str
    firstName: str
    lastName: str | None = None
    emailAddress: str | None = None


class RefreshTokenBody(BaseModel):
    """Body claims carried in a Sudomimus refresh token.

    Carries the sector ``subject`` (the same pairwise identifier as the
    access-token body) because the refresh token leaves the system and
    must never expose the internal account identifier. Informational only
    — ``/refresh`` resolves the token by its ``jti``.
    """

    subject: str


class IdTokenHeader(BaseModel):
    """Header claims of an OIDC ``id_token``.

    Unlike Sudomimus access/refresh tokens, an id_token is a standard OIDC
    JWT: ``kid`` identifies the platform signing key in the OIDC JWKS.
    """

    alg: str | None = None
    typ: str | None = None
    kid: str | None = None


class IdTokenBody(BaseModel):
    """Body claims of a Sudomimus OIDC ``id_token``.

    Every claim lives in the JWT body (standard OIDC). ``sub`` is the
    per-(account, sector) sector subject — identical to the access-token
    body ``subject``. The token is signed by the platform key.
    """

    iss: str
    sub: str
    aud: str
    iat: int
    exp: int
    at_hash: str | None = None
    nonce: str | None = None
    auth_time: int | None = None
    email: str | None = None
    email_verified: bool | None = None
    name: str | None = None
    amr: list[str] | None = None
    acr: str | None = None


class UserInfoResponse(BaseModel):
    """Decoded response of the OIDC ``/userinfo`` endpoint."""

    sub: str
    email: str | None = None
    email_verified: bool | None = None
    name: str | None = None
