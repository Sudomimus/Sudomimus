"""Client-auth JWT signing for the Connect ``/establish`` endpoint.

The server requires an ``Authorization: SudomimusClientJWT <jwt>`` header
whose claims live in the JWT *body*: ``iss`` (the application anchor),
``aud`` (``"sudomimus-connect"``), ``iat``, ``exp`` (lifetime at most 60s),
a single-use ``jti``, and ``body_sha256`` — standard base64 of
``SHA-256(rawHttpBody)`` over the exact UTF-8 bytes sent on the wire.
"""

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
from .errors import ConnectConfigError

ClientAuthSigner = Callable[[str], str | Awaitable[str]]


@dataclass(frozen=True, slots=True)
class ConnectClientAuthWithKey:
    """Sign client-auth JWTs locally with a PEM-encoded RS256 private key."""

    application_anchor: str
    private_key_pem: str
    lifetime_seconds: int | None = None
    jti_generator: Callable[[], str] | None = None


@dataclass(frozen=True, slots=True)
class ConnectClientAuthWithSigner:
    """Delegate client-auth JWT creation to a bring-your-own signer.

    The signer receives the exact JSON string sent on the wire and MUST
    return a signed JWT whose ``body_sha256`` claim is the standard base64 of
    ``SHA-256(rawBody)``. The signer may be sync or (for the async client)
    return an awaitable.
    """

    application_anchor: str
    signer: ClientAuthSigner


ConnectClientAuth = ConnectClientAuthWithKey | ConnectClientAuthWithSigner


def sha256_base64(raw_body: str) -> str:
    """Standard base64 of ``SHA-256(raw_body)`` over UTF-8 bytes."""
    digest = hashlib.sha256(raw_body.encode("utf-8")).digest()
    return base64.b64encode(digest).decode("ascii")


def build_establish_client_jwt_claims(
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
        raise ConnectConfigError(
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


def sign_establish_client_jwt(config: ConnectClientAuthWithKey, raw_body: str) -> str:
    """Sign a client-auth JWT (claims in the body, empty header) with RS256."""
    claims = build_establish_client_jwt_claims(
        config.application_anchor,
        raw_body,
        lifetime_seconds=config.lifetime_seconds,
        jti_generator=config.jti_generator,
    )
    return create_jwt({}, claims, config.private_key_pem)
