"""Claim models for Sudomimus application and OIDC tokens."""

from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

_ABSOLUTE_URI = re.compile(r"^[A-Za-z][A-Za-z0-9+.-]*:[^\s]*$")


def _validate_absolute_uri(value: str) -> str:
    if _ABSOLUTE_URI.fullmatch(value) is None:
        raise ValueError("must be an absolute URI")
    return value


class JwtHeader(BaseModel):
    """Loose JOSE header used only to classify a token before strict parsing."""

    alg: str | None = None
    typ: str | None = None
    kid: str | None = None


class AccessTokenHeader(BaseModel):
    """Exact JOSE protected header of an application access token."""

    model_config = ConfigDict(extra="forbid")
    alg: Literal["RS256"]
    kid: str = Field(min_length=1)
    typ: Literal["vnd.sudomimus.application-access+jwt"]


class RefreshTokenHeader(BaseModel):
    """Exact JOSE protected header of an application refresh token."""

    model_config = ConfigDict(extra="forbid")
    alg: Literal["RS256"]
    kid: str = Field(min_length=1)
    typ: Literal["vnd.sudomimus.application-refresh+jwt"]


class AccessTokenBody(BaseModel):
    """Minimal registered claims carried by an application access token."""

    model_config = ConfigDict(extra="forbid")
    iss: str = Field(min_length=1)
    aud: str = Field(min_length=1)
    sub: str = Field(min_length=1)
    sid: str = Field(min_length=1)
    jti: str = Field(min_length=1)
    iat: int = Field(ge=0)
    exp: int = Field(ge=1)

    _validate_issuer = field_validator("iss")(_validate_absolute_uri)


class RefreshTokenBody(BaseModel):
    """Session binding and rotation state carried by a refresh token."""

    model_config = ConfigDict(extra="forbid")
    iss: str = Field(min_length=1)
    aud: str = Field(min_length=1)
    sid: str = Field(min_length=1)
    jti: str = Field(min_length=1)
    iat: int = Field(ge=0)
    exp: int = Field(ge=1)
    rotationVersion: int = Field(ge=1)

    _validate_issuer = field_validator("iss")(_validate_absolute_uri)


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
    body ``sub``. The token is signed by the platform key.
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
