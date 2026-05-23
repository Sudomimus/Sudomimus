"""Parsed-token container with signature and expiration checks."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Generic, TypeVar

from ._codec import verify_rs256
from .models import AccessTokenBody, JwtHeader, RefreshTokenBody

BodyT = TypeVar("BodyT", bound="AccessTokenBody | RefreshTokenBody")


@dataclass(frozen=True, slots=True)
class JwtToken(Generic[BodyT]):
    """A parsed Sudomimus JWT.

    Exposes the header (envelope claims), the typed body, and the verbatim
    ``signing_input`` so callers can re-verify the signature against their
    own public key without re-encoding the deserialized claims.
    """

    raw: str
    signing_input: bytes
    signature: bytes
    header: JwtHeader
    body: BodyT

    def verify_signature(self, public_key_pem: str) -> bool:
        """Return ``True`` when the signature matches the given RSA public key."""
        return verify_rs256(public_key_pem, self.signing_input, self.signature)

    def verify_expiration(self, now: datetime) -> bool:
        """Return ``True`` when the token's ``exp`` claim is still in the future."""
        if self.header.exp is None:
            return False
        expires_at = datetime.fromtimestamp(self.header.exp, tz=UTC)
        return now < expires_at


AccessToken = JwtToken[AccessTokenBody]
RefreshToken = JwtToken[RefreshTokenBody]
