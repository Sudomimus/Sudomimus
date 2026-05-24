"""Low-level JWT codec: base64url, JSON segments, and RS256 sign/verify.

Sudomimus JWTs follow the on-wire layout used by ``@sudoo/jwt``: three
base64url segments (no padding) joined by dots, where the signing input is
the literal ``headerSegment.bodySegment`` string (UTF-8). Standard envelope
claims live in the header segment, not the body.
"""

from __future__ import annotations

import base64
import json
from typing import Any

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey, RSAPublicKey


def decode_base64url(segment: str) -> bytes:
    """Decode a base64url segment, tolerating missing padding."""
    padding_len = (-len(segment)) % 4
    return base64.urlsafe_b64decode(segment + ("=" * padding_len))


def encode_base64url(data: bytes) -> str:
    """Encode bytes as base64url without padding."""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _json_segment_bytes(value: dict[str, Any]) -> bytes:
    return json.dumps(value, separators=(",", ":")).encode("utf-8")


def verify_rs256(public_key_pem: str, signing_input: bytes, signature: bytes) -> bool:
    """Verify an RS256 signature against a PEM-encoded RSA public key.

    Returns ``False`` for a signature mismatch or a non-RSA key (which can
    never produce a valid RS256 signature).
    """
    public_key = serialization.load_pem_public_key(public_key_pem.encode("utf-8"))
    if not isinstance(public_key, RSAPublicKey):
        return False
    try:
        public_key.verify(signature, signing_input, padding.PKCS1v15(), hashes.SHA256())
        return True
    except InvalidSignature:
        return False


def sign_rs256(private_key_pem: str, signing_input: bytes) -> bytes:
    """Produce an RS256 signature with a PEM-encoded RSA private key."""
    private_key = serialization.load_pem_private_key(
        private_key_pem.encode("utf-8"),
        password=None,
    )
    if not isinstance(private_key, RSAPrivateKey):
        raise ValueError("client-auth private key must be an RSA private key for RS256.")
    return private_key.sign(signing_input, padding.PKCS1v15(), hashes.SHA256())


def create_jwt(
    header: dict[str, Any],
    body: dict[str, Any],
    private_key_pem: str,
) -> str:
    """Build a signed compact JWT from header/body claim dicts.

    Mirrors ``@sudoo/jwt``'s creator: each segment is base64url of its JSON,
    and the signature signs the literal ``headerSegment.bodySegment`` bytes.
    """
    header_segment = encode_base64url(_json_segment_bytes(header))
    body_segment = encode_base64url(_json_segment_bytes(body))
    signing_input = f"{header_segment}.{body_segment}".encode("ascii")
    signature_segment = encode_base64url(sign_rs256(private_key_pem, signing_input))
    return f"{header_segment}.{body_segment}.{signature_segment}"
