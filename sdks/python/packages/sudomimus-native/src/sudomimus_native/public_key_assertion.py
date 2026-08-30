"""Signed assertion helpers for Native public-key direct issue."""

from __future__ import annotations

import base64
import hashlib
import json
import secrets
import time
from collections.abc import Callable
from dataclasses import dataclass

from ._generated.models import DirectIssuePublicKeyRequest

PUBLIC_KEY_ASSERTION_AUDIENCE = "sudomimus-native-public-key"
PUBLIC_KEY_ASSERTION_TYPE = "vnd.sudomimus.public-key-assertion+jwt"
PUBLIC_KEY_AUTHORIZATION_SCHEME = "SudomimusPublicKeyJWT"


def _base64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


@dataclass(frozen=True, slots=True)
class PublicKeyCredential:
    """Registered Ed25519 key ID and raw-signature callback."""

    key_id: str
    sign: Callable[[bytes], bytes]


@dataclass(frozen=True, slots=True)
class SignedPublicKeyRequest:
    """Exact request bytes and matching Authorization value."""

    body: bytes
    authorization: str


def sign_public_key_request(
    request: DirectIssuePublicKeyRequest,
    credential: PublicKeyCredential,
    *,
    now: int | None = None,
    jti_bytes: bytes | None = None,
) -> SignedPublicKeyRequest:
    """Serialize once and bind those exact bytes into a compact EdDSA JWT."""
    body = request.model_dump_json(exclude_none=True).encode("utf-8")
    issued_at = int(time.time()) if now is None else now
    nonce = secrets.token_bytes(16) if jti_bytes is None else jti_bytes
    if len(nonce) != 16:
        raise ValueError("jti_bytes must contain exactly 16 random bytes")

    header = {
        "alg": "EdDSA",
        "typ": PUBLIC_KEY_ASSERTION_TYPE,
        "kid": credential.key_id,
    }
    claims = {
        "iss": credential.key_id,
        "aud": PUBLIC_KEY_ASSERTION_AUDIENCE,
        "iat": issued_at,
        "exp": issued_at + 60,
        "jti": _base64url(nonce),
        "requestHash": _base64url(hashlib.sha256(body).digest()),
    }
    encode_json = lambda value: json.dumps(  # noqa: E731
        value, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")
    signing_input = (
        _base64url(encode_json(header)) + "." + _base64url(encode_json(claims))
    ).encode("ascii")
    signature = credential.sign(signing_input)
    if len(signature) != 64:
        raise ValueError("Ed25519 signatures must contain exactly 64 bytes")
    assertion = signing_input.decode("ascii") + "." + _base64url(signature)
    return SignedPublicKeyRequest(
        body=body,
        authorization=f"{PUBLIC_KEY_AUTHORIZATION_SCHEME} {assertion}",
    )
