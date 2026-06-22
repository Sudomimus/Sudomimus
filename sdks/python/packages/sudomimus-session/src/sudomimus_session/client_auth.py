"""Client-auth JWT signing for the Session ``/revoke-all`` endpoint."""

from __future__ import annotations

import base64
import hashlib
import time
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from sudomimus_token import create_jwt

from .constants import (
    CLIENT_JWT_AUDIENCE,
    CLIENT_JWT_DEFAULT_LIFETIME_SECONDS,
    CLIENT_JWT_MAX_LIFETIME_SECONDS,
)
from .errors import SessionConfigError

ClientAuthSigner = Callable[[str], str | Awaitable[str]]


@dataclass(frozen=True, slots=True)
class SessionClientAuthWithKey:
    """Sign client-auth JWTs locally with a PEM-encoded RS256 private key."""

    application_anchor: str
    private_key_pem: str
    lifetime_seconds: int | None = None
    jti_generator: Callable[[], str] | None = None


@dataclass(frozen=True, slots=True)
class SessionClientAuthWithSigner:
    """Delegate client-auth JWT creation to a bring-your-own signer."""

    application_anchor: str
    signer: ClientAuthSigner


SessionClientAuth = SessionClientAuthWithKey | SessionClientAuthWithSigner


def sha256_base64(raw_body: str) -> str:
    """Standard base64 of ``SHA-256(raw_body)`` over UTF-8 bytes."""
    digest = hashlib.sha256(raw_body.encode("utf-8")).digest()
    return base64.b64encode(digest).decode("ascii")


def build_session_client_jwt_claims(
    application_anchor: str,
    raw_body: str,
    *,
    lifetime_seconds: int | None = None,
    jti_generator: Callable[[], str] | None = None,
    now: float | None = None,
) -> dict[str, Any]:
    """Build the client-auth JWT claim set without signing it."""
    lifetime = (
        lifetime_seconds
        if lifetime_seconds is not None
        else CLIENT_JWT_DEFAULT_LIFETIME_SECONDS
    )
    if lifetime <= 0 or lifetime > CLIENT_JWT_MAX_LIFETIME_SECONDS:
        raise SessionConfigError(
            f"clientAuth.lifetime_seconds must be in (0, {CLIENT_JWT_MAX_LIFETIME_SECONDS}]; "
            f"got {lifetime}"
        )

    iat = int(now if now is not None else time.time())
    jti = jti_generator() if jti_generator is not None else str(uuid.uuid4())
    return {
        "iss": application_anchor,
        "aud": CLIENT_JWT_AUDIENCE,
        "iat": iat,
        "exp": iat + lifetime,
        "jti": jti,
        "body_sha256": sha256_base64(raw_body),
    }


def sign_session_client_jwt(config: SessionClientAuthWithKey, raw_body: str) -> str:
    """Sign a client-auth JWT (claims in the body, empty header) with RS256."""
    claims = build_session_client_jwt_claims(
        config.application_anchor,
        raw_body,
        lifetime_seconds=config.lifetime_seconds,
        jti_generator=config.jti_generator,
    )
    return create_jwt({}, claims, config.private_key_pem)
