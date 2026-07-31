"""RSA JWK conversion helpers for application token verification."""

from __future__ import annotations

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from ._codec import decode_base64url


def rsa_jwk_to_pem(*, modulus: str, exponent: str) -> str:
    """Convert base64url RSA JWK parameters into an SPKI PEM public key."""
    n = int.from_bytes(decode_base64url(modulus), "big")
    e = int.from_bytes(decode_base64url(exponent), "big")
    key = rsa.RSAPublicNumbers(e=e, n=n).public_key()
    return key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("ascii")
