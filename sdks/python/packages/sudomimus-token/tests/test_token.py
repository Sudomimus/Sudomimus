"""Tests for parsing and verifying Sudomimus tokens."""

from __future__ import annotations

import asyncio
import time

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from sudomimus_token import (
    AsyncTokenVerifier,
    TokenError,
    TokenErrorCode,
    TokenVerifier,
    create_jwt,
    decode_base64url,
    encode_base64url,
    parse_access_token,
    peek_header,
)

ANCHOR = "app-anchor"


def _keypair() -> tuple[str, str]:
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("ascii")
    public_pem = key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("ascii")
    return private_pem, public_pem


def _mint(
    private_pem: str,
    *,
    kty: str = "Access",
    aud: str | None = ANCHOR,
    exp_offset: int = 60,
    body: dict | None = None,
) -> str:
    header: dict = {"kty": kty, "iat": int(time.time()), "exp": int(time.time()) + exp_offset}
    if aud is not None:
        header["aud"] = aud
    default_body = (
        {"subject": "subject-1", "firstName": "Ada"}
        if kty == "Access"
        else {"subject": "subject-1"}
    )
    return create_jwt(header, body if body is not None else default_body, private_pem)


def test_base64url_round_trip() -> None:
    data = b"\x00\x01\x02hello-world\xff\xfe"
    assert decode_base64url(encode_base64url(data)) == data


def test_verify_access_token_happy_path() -> None:
    private_pem, public_pem = _keypair()
    jwt = _mint(private_pem)
    token = TokenVerifier(lambda _: public_pem).verify_access_token(jwt)
    assert token.body.subject == "subject-1"
    assert token.body.firstName == "Ada"
    assert token.header.aud == ANCHOR


def test_verify_refresh_token_happy_path() -> None:
    private_pem, public_pem = _keypair()
    jwt = _mint(private_pem, kty="Refresh")
    token = TokenVerifier(lambda _: public_pem).verify_refresh_token(jwt)
    assert token.body.subject == "subject-1"


def test_wrong_key_type() -> None:
    private_pem, public_pem = _keypair()
    refresh_jwt = _mint(private_pem, kty="Refresh")
    with pytest.raises(TokenError) as exc:
        TokenVerifier(lambda _: public_pem).verify_access_token(refresh_jwt)
    assert exc.value.code is TokenErrorCode.WRONG_KEY_TYPE


def test_missing_audience() -> None:
    private_pem, public_pem = _keypair()
    jwt = _mint(private_pem, aud=None)
    with pytest.raises(TokenError) as exc:
        TokenVerifier(lambda _: public_pem).verify_access_token(jwt)
    assert exc.value.code is TokenErrorCode.MISSING_AUDIENCE


def test_expired_token() -> None:
    private_pem, public_pem = _keypair()
    jwt = _mint(private_pem, exp_offset=-10)
    with pytest.raises(TokenError) as exc:
        TokenVerifier(lambda _: public_pem).verify_access_token(jwt)
    assert exc.value.code is TokenErrorCode.EXPIRED


def test_invalid_signature_wrong_key() -> None:
    private_pem, _ = _keypair()
    _, other_public_pem = _keypair()
    jwt = _mint(private_pem)
    with pytest.raises(TokenError) as exc:
        TokenVerifier(lambda _: other_public_pem).verify_access_token(jwt)
    assert exc.value.code is TokenErrorCode.INVALID_SIGNATURE


def test_malformed_jwt() -> None:
    _, public_pem = _keypair()
    with pytest.raises(TokenError) as exc:
        TokenVerifier(lambda _: public_pem).verify_access_token("not-a-jwt")
    assert exc.value.code is TokenErrorCode.INVALID_JWT


def test_peek_header_reads_key_type() -> None:
    private_pem, _ = _keypair()
    jwt = _mint(private_pem)
    assert peek_header(jwt).kty == "Access"


def test_parse_does_not_verify_signature() -> None:
    private_pem, _ = _keypair()
    jwt = _mint(private_pem)
    # Parsing succeeds without any public key; only the verifier checks trust.
    parsed = parse_access_token(jwt)
    assert parsed.body.firstName == "Ada"


def test_async_verifier_happy_path() -> None:
    private_pem, public_pem = _keypair()
    jwt = _mint(private_pem)

    async def resolver(_: str) -> str:
        return public_pem

    async def run() -> str:
        token = await AsyncTokenVerifier(resolver).verify_access_token(jwt)
        return token.body.subject

    assert asyncio.run(run()) == "subject-1"
