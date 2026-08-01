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
    typ: str = "vnd.sudomimus.application-access+jwt",
    aud: str | None = ANCHOR,
    exp_offset: int = 60,
    kid: str | None = "key-1",
    body: dict | None = None,
) -> str:
    now = int(time.time())
    header: dict = {"alg": "RS256", "typ": typ}
    if kid is not None:
        header["kid"] = kid
    default_body = {
        "iss": "https://connect-api.sudomimus.com",
        "sid": "session-1",
        "jti": "access-1" if typ.endswith("access+jwt") else "refresh-1",
        "iat": now,
        "exp": now + exp_offset,
    }
    if aud is not None:
        default_body["aud"] = aud
    if typ.endswith("access+jwt"):
        default_body["sub"] = "subject-1"
    else:
        default_body["rotationVersion"] = 1
    return create_jwt(header, body if body is not None else default_body, private_pem)


def test_base64url_round_trip() -> None:
    data = b"\x00\x01\x02hello-world\xff\xfe"
    assert decode_base64url(encode_base64url(data)) == data


def test_verify_access_token_happy_path() -> None:
    private_pem, public_pem = _keypair()
    jwt = _mint(private_pem)
    token = TokenVerifier(lambda _aud, _kid: public_pem).verify_access_token(jwt)
    assert token.body.sub == "subject-1"
    assert token.body.sid == "session-1"
    assert token.body.aud == ANCHOR


def test_access_token_rejects_profile_claims() -> None:
    private_pem, public_pem = _keypair()
    now = int(time.time())
    jwt = _mint(
        private_pem,
        body={
            "iss": "https://connect-api.sudomimus.com",
            "aud": ANCHOR,
            "sub": "subject-1",
            "sid": "session-1",
            "jti": "access-1",
            "iat": now,
            "exp": now + 60,
            "firstName": "Ada",
        },
    )
    with pytest.raises(TokenError) as exc:
        TokenVerifier(lambda _aud, _kid: public_pem).verify_access_token(jwt)
    assert exc.value.code is TokenErrorCode.INVALID_JWT


def test_verify_refresh_token_happy_path() -> None:
    private_pem, public_pem = _keypair()
    jwt = _mint(private_pem, typ="vnd.sudomimus.application-refresh+jwt")
    token = TokenVerifier(lambda _aud, _kid: public_pem).verify_refresh_token(jwt)
    assert token.body.sid == "session-1"
    assert token.body.rotationVersion == 1


def test_wrong_token_type() -> None:
    private_pem, public_pem = _keypair()
    refresh_jwt = _mint(private_pem, typ="vnd.sudomimus.application-refresh+jwt")
    with pytest.raises(TokenError) as exc:
        TokenVerifier(lambda _aud, _kid: public_pem).verify_access_token(refresh_jwt)
    assert exc.value.code is TokenErrorCode.WRONG_TOKEN_TYPE


def test_missing_audience() -> None:
    private_pem, public_pem = _keypair()
    jwt = _mint(private_pem, aud=None)
    with pytest.raises(TokenError) as exc:
        TokenVerifier(lambda _aud, _kid: public_pem).verify_access_token(jwt)
    assert exc.value.code is TokenErrorCode.MISSING_AUDIENCE


def test_expired_token() -> None:
    private_pem, public_pem = _keypair()
    jwt = _mint(private_pem, exp_offset=-10)
    with pytest.raises(TokenError) as exc:
        TokenVerifier(lambda _aud, _kid: public_pem).verify_access_token(jwt)
    assert exc.value.code is TokenErrorCode.EXPIRED


def test_invalid_signature_wrong_key() -> None:
    private_pem, _ = _keypair()
    _, other_public_pem = _keypair()
    jwt = _mint(private_pem)
    with pytest.raises(TokenError) as exc:
        TokenVerifier(lambda _aud, _kid: other_public_pem).verify_access_token(jwt)
    assert exc.value.code is TokenErrorCode.INVALID_SIGNATURE


def test_malformed_jwt() -> None:
    _, public_pem = _keypair()
    with pytest.raises(TokenError) as exc:
        TokenVerifier(lambda _aud, _kid: public_pem).verify_access_token("not-a-jwt")
    assert exc.value.code is TokenErrorCode.INVALID_JWT


def test_peek_header_reads_token_type() -> None:
    private_pem, _ = _keypair()
    jwt = _mint(private_pem)
    assert peek_header(jwt).typ == "vnd.sudomimus.application-access+jwt"


def test_parse_does_not_verify_signature() -> None:
    private_pem, _ = _keypair()
    jwt = _mint(private_pem)
    # Parsing succeeds without any public key; only the verifier checks trust.
    parsed = parse_access_token(jwt)
    assert parsed.body.sub == "subject-1"


def test_async_verifier_happy_path() -> None:
    private_pem, public_pem = _keypair()
    jwt = _mint(private_pem)

    async def resolver(_aud: str, _kid: str) -> str:
        return public_pem

    async def run() -> str:
        token = await AsyncTokenVerifier(resolver).verify_access_token(jwt)
        return token.body.sub

    assert asyncio.run(run()) == "subject-1"
