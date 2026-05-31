"""OIDC ``id_token`` parsing and verification.

An id_token is a standard OIDC JWT: its claims live in the body and it is
signed by the **platform** key (resolve it from the OIDC JWKS by the header
``kid``), not by an application's signing key. This module therefore checks
``exp`` from the body, not the header.
"""

from __future__ import annotations

import binascii
from dataclasses import dataclass
from datetime import UTC, datetime

from pydantic import ValidationError

from ._codec import decode_base64url, verify_rs256
from .errors import TokenError, TokenErrorCode
from .models import IdTokenBody, IdTokenHeader


@dataclass(frozen=True, slots=True)
class IdToken:
    """A parsed OIDC id_token (header + body + verbatim signing input)."""

    raw: str
    signing_input: bytes
    signature: bytes
    header: IdTokenHeader
    body: IdTokenBody

    def verify_signature(self, public_key_pem: str) -> bool:
        """Return ``True`` when the signature matches the given RSA public key."""
        return verify_rs256(public_key_pem, self.signing_input, self.signature)


def parse_id_token(jwt: str) -> IdToken:
    """Parse an id_token into its header and body without verifying it."""
    if not jwt:
        raise TokenError(TokenErrorCode.INVALID_JWT, "Token is empty.")
    parts = jwt.split(".")
    if len(parts) != 3:
        raise TokenError(
            TokenErrorCode.INVALID_JWT,
            f"Token must have exactly three dot-separated segments; got {len(parts)}.",
        )
    header_segment, body_segment, signature_segment = parts
    try:
        header_bytes = decode_base64url(header_segment)
        body_bytes = decode_base64url(body_segment)
        signature_bytes = decode_base64url(signature_segment)
    except (binascii.Error, ValueError) as exc:
        raise TokenError(
            TokenErrorCode.INVALID_JWT, f"Failed to decode JWT segments: {exc}"
        ) from exc

    try:
        header = IdTokenHeader.model_validate_json(header_bytes)
        body = IdTokenBody.model_validate_json(body_bytes)
    except ValidationError as exc:
        raise TokenError(
            TokenErrorCode.INVALID_JWT, f"Failed to deserialize id_token: {exc}"
        ) from exc

    return IdToken(
        raw=jwt,
        signing_input=f"{header_segment}.{body_segment}".encode("ascii"),
        signature=signature_bytes,
        header=header,
        body=body,
    )


def verify_id_token(
    jwt: str,
    platform_public_key_pem: str,
    *,
    audience: str | None = None,
    issuer: str | None = None,
    nonce: str | None = None,
    now: datetime | None = None,
) -> IdToken:
    """Verify an OIDC id_token against a platform public key.

    Checks the body ``exp``, the RS256 signature, and any supplied
    ``audience`` / ``issuer`` / ``nonce`` expectations. Returns the parsed
    token or raises :class:`TokenError`.
    """
    parsed = parse_id_token(jwt)
    current = now if now is not None else datetime.now(tz=UTC)

    if datetime.fromtimestamp(parsed.body.exp, tz=UTC) <= current:
        raise TokenError(TokenErrorCode.EXPIRED, "id_token has expired.")

    if not parsed.verify_signature(platform_public_key_pem):
        raise TokenError(
            TokenErrorCode.INVALID_SIGNATURE,
            "id_token signature does not match the platform public key.",
        )

    if audience is not None and parsed.body.aud != audience:
        raise TokenError(
            TokenErrorCode.WRONG_AUDIENCE,
            "id_token `aud` does not match the expected client id.",
        )

    if issuer is not None and parsed.body.iss != issuer:
        raise TokenError(
            TokenErrorCode.WRONG_ISSUER,
            "id_token `iss` does not match the expected issuer.",
        )

    if nonce is not None and parsed.body.nonce != nonce:
        raise TokenError(
            TokenErrorCode.WRONG_NONCE,
            "id_token `nonce` does not match the value sent at /authorize.",
        )

    return parsed
