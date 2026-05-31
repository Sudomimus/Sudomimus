"""Tests for parsing and verifying OIDC id_tokens."""

from __future__ import annotations

import time

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from sudomimus_token import (
    TokenError,
    TokenErrorCode,
    create_jwt,
    parse_id_token,
    verify_id_token,
)


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


def _mint_id_token(private_pem: str, **body_overrides: object) -> str:
    iat = int(time.time())
    header = {"alg": "RS256", "typ": "JWT", "kid": "platform-1"}
    body = {
        "iss": "https://oidc.sudomimus.com",
        "sub": "subject-1",
        "aud": "client-1",
        "iat": iat,
        "exp": iat + 3600,
        "email": "ada@example.com",
        "email_verified": True,
        "name": "Ada Lovelace",
    }
    body.update(body_overrides)
    return create_jwt(header, body, private_pem)


def test_parse_id_token_exposes_body() -> None:
    private_pem, _ = _keypair()
    token = parse_id_token(_mint_id_token(private_pem))
    assert token.body.sub == "subject-1"
    assert token.body.email == "ada@example.com"
    assert token.header.kid == "platform-1"


def test_verify_id_token_happy_path() -> None:
    private_pem, public_pem = _keypair()
    jwt = _mint_id_token(private_pem, nonce="n-1")
    token = verify_id_token(
        jwt,
        public_pem,
        audience="client-1",
        issuer="https://oidc.sudomimus.com",
        nonce="n-1",
    )
    assert token.body.sub == "subject-1"


def test_verify_id_token_expired() -> None:
    private_pem, public_pem = _keypair()
    past = int(time.time()) - 10
    jwt = _mint_id_token(private_pem, iat=past - 3600, exp=past)
    with pytest.raises(TokenError) as exc:
        verify_id_token(jwt, public_pem)
    assert exc.value.code == TokenErrorCode.EXPIRED


def test_verify_id_token_wrong_signature() -> None:
    private_pem, _ = _keypair()
    _, other_public = _keypair()
    with pytest.raises(TokenError) as exc:
        verify_id_token(_mint_id_token(private_pem), other_public)
    assert exc.value.code == TokenErrorCode.INVALID_SIGNATURE


def test_verify_id_token_wrong_nonce() -> None:
    private_pem, public_pem = _keypair()
    jwt = _mint_id_token(private_pem, nonce="n-1")
    with pytest.raises(TokenError) as exc:
        verify_id_token(jwt, public_pem, nonce="n-2")
    assert exc.value.code == TokenErrorCode.WRONG_NONCE
