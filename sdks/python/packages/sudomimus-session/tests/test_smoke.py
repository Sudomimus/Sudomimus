"""Tests for sudomimus_session."""

from __future__ import annotations

import asyncio
import json
from collections.abc import Callable

import httpx
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from sudomimus_session import (
    PRODUCTION_BASE_URL,
    AsyncSessionClient,
    IntrospectRequest,
    LogoutRequest,
    RefreshRequest,
    RevokeAllRequest,
    SessionApiError,
    SessionClient,
    SessionClientAuthWithKey,
    SessionClientAuthWithSigner,
    SessionConfigError,
    sha256_base64,
)
from sudomimus_token import decode_base64url

Handler = Callable[[httpx.Request], httpx.Response]


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


def _client(handler: Handler, **kwargs: object) -> SessionClient:
    transport = httpx.MockTransport(handler)
    return SessionClient(http_client=httpx.Client(transport=transport), **kwargs)  # type: ignore[arg-type]


def _claims() -> dict[str, dict[str, str]]:
    return {
        "email": {"requirement": "OFF", "state": "UNKNOWN"},
        "firstName": {"requirement": "OFF", "state": "UNKNOWN"},
        "lastName": {"requirement": "OFF", "state": "UNKNOWN"},
    }


def test_base_url_normalized_and_default() -> None:
    assert SessionClient(base_url="https://session.example.com/").base_url == (
        "https://session.example.com"
    )
    assert SessionClient().base_url == PRODUCTION_BASE_URL


def test_refresh_introspect_logout() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/refresh":
            return httpx.Response(
                200,
                json={"accessToken": "a2", "refreshToken": "r2", "claims": _claims()},
            )
        if request.url.path == "/introspect":
            assert request.headers.get("Authorization") is None
            return httpx.Response(200, json={"status": "active", "recommendedRecheckSeconds": 15})
        if request.url.path == "/logout":
            return httpx.Response(200, json={"revoked": True})
        return httpx.Response(404)

    with _client(handler) as client:
        refreshed = client.refresh(RefreshRequest(refreshToken="r1"))
        introspected = client.introspect(IntrospectRequest(accessToken="a2"))
        logged_out = client.logout(LogoutRequest(refreshToken="r2"))

    assert refreshed.accessToken == "a2"
    assert refreshed.refreshToken == "r2"
    assert introspected.status == "active"
    assert logged_out.revoked is True


def test_revoke_all_requires_client_auth() -> None:
    with _client(lambda r: httpx.Response(200)) as client, pytest.raises(SessionConfigError):
        client.revoke_all(RevokeAllRequest(subject="subject-1"))


def test_revoke_all_signs_with_session_audience() -> None:
    private_pem, _ = _keypair()
    captured: dict[str, str] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["auth"] = request.headers["Authorization"]
        captured["raw"] = request.content.decode("utf-8")
        captured["path"] = request.url.path
        return httpx.Response(200, json={"revokedCount": 2})

    auth = SessionClientAuthWithKey(application_anchor="my-app", private_key_pem=private_pem)
    with _client(handler, client_auth=auth) as client:
        result = client.revoke_all(RevokeAllRequest(subject="subject-1"))

    assert result.revokedCount == 2
    assert captured["path"] == "/revoke-all"
    scheme, _, jwt = captured["auth"].partition(" ")
    assert scheme == "SudomimusClientJWT"
    claims = json.loads(decode_base64url(jwt.split(".")[1]))
    assert claims["iss"] == "my-app"
    assert claims["aud"] == "sudomimus-session"
    assert claims["body_sha256"] == sha256_base64(captured["raw"])


def test_revoke_all_with_byo_signer() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["Authorization"] == "SudomimusClientJWT fixed.jwt.value"
        return httpx.Response(200, json={"revokedCount": 1})

    auth = SessionClientAuthWithSigner(
        application_anchor="my-app", signer=lambda _raw: "fixed.jwt.value"
    )
    with _client(handler, client_auth=auth) as client:
        result = client.revoke_all(RevokeAllRequest(subject="subject-1"))

    assert result.revokedCount == 1


def test_error_with_reason_and_empty_body() -> None:
    with _client(lambda r: httpx.Response(401, json={"reason": "RefreshTokenExpired"})) as client:
        with pytest.raises(SessionApiError) as exc:
            client.refresh(RefreshRequest(refreshToken="bad"))
    assert exc.value.status == 401
    assert exc.value.reason == "RefreshTokenExpired"

    with _client(lambda r: httpx.Response(500, content=b"")) as client:
        with pytest.raises(SessionApiError) as empty_exc:
            client.health()
    assert empty_exc.value.reason is None


def test_health() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/health"
        return httpx.Response(200, json={"ready": True, "service": "session", "version": "1"})

    with _client(handler) as client:
        result = client.health()
    assert result.ready is True
    assert result.service == "session"


def test_async_refresh_introspect_logout_and_revoke_all() -> None:
    private_pem, _ = _keypair()

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/refresh":
            return httpx.Response(
                200,
                json={"accessToken": "a2", "refreshToken": "r2", "claims": _claims()},
            )
        if request.url.path == "/introspect":
            return httpx.Response(200, json={"status": "active", "recommendedRecheckSeconds": 30})
        if request.url.path == "/logout":
            return httpx.Response(200, json={"revoked": True})
        assert request.url.path == "/revoke-all"
        assert request.headers["Authorization"].startswith("SudomimusClientJWT ")
        return httpx.Response(200, json={"revokedCount": 3})

    auth = SessionClientAuthWithKey(application_anchor="my-app", private_key_pem=private_pem)

    async def run() -> tuple[str, str, bool, int]:
        async with AsyncSessionClient(
            http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
            client_auth=auth,
        ) as client:
            refreshed = await client.refresh(RefreshRequest(refreshToken="r1"))
            introspected = await client.introspect(IntrospectRequest(accessToken="a2"))
            logged_out = await client.logout(LogoutRequest(refreshToken="r2"))
            revoked = await client.revoke_all(RevokeAllRequest(subject="subject-1"))
            return refreshed.accessToken, introspected.status, logged_out.revoked, revoked.revokedCount

    access_token, status, revoked, count = asyncio.run(run())
    assert access_token == "a2"
    assert status == "active"
    assert revoked is True
    assert count == 3


@pytest.mark.filterwarnings("ignore::RuntimeWarning")
def test_sync_signer_returning_awaitable_raises() -> None:
    async def async_signer(_raw: str) -> str:
        return "nope"

    auth = SessionClientAuthWithSigner(application_anchor="my-app", signer=async_signer)
    with _client(lambda r: httpx.Response(200), client_auth=auth) as client:
        with pytest.raises(SessionConfigError):
            client.revoke_all(RevokeAllRequest(subject="subject-1"))
