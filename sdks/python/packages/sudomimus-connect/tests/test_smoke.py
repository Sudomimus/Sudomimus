"""Tests for sudomimus_connect."""

from __future__ import annotations

import asyncio
import json
import time
from collections.abc import Callable

import httpx
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from sudomimus_connect import (
    PRODUCTION_BASE_URL,
    AsyncConnectClient,
    ConnectApiError,
    ConnectClient,
    ConnectClientAuthWithKey,
    ConnectClientAuthWithSigner,
    ConnectConfigError,
    EstablishRequest,
    IntrospectRequest,
    LogoutRequest,
    RedeemRequest,
    RefreshRequest,
    RevokeAllRequest,
    StatusPollRequest,
    sha256_base64,
)
from sudomimus_token import create_jwt, decode_base64url

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


def _client(handler: Handler, **kwargs: object) -> ConnectClient:
    transport = httpx.MockTransport(handler)
    return ConnectClient(http_client=httpx.Client(transport=transport), **kwargs)  # type: ignore[arg-type]


def test_base_url_normalized() -> None:
    assert ConnectClient(base_url="https://connect.example.com/").base_url == (
        "https://connect.example.com"
    )


def test_default_base_url_is_production() -> None:
    assert ConnectClient().base_url == PRODUCTION_BASE_URL


def test_establish_requires_client_auth() -> None:
    with _client(lambda r: httpx.Response(200)) as client, pytest.raises(ConnectConfigError):
        client.establish(EstablishRequest(applicationAnchor="my-app"))


def test_establish_signs_request_with_matching_body_hash() -> None:
    private_pem, _ = _keypair()
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["auth"] = request.headers["Authorization"]
        captured["raw"] = request.content.decode("utf-8")
        return httpx.Response(
            200,
            json={
                "applicationAnchor": "my-app",
                "exposureKey": "ek",
                "hiddenKey": "hk",
            },
        )

    auth = ConnectClientAuthWithKey(application_anchor="my-app", private_key_pem=private_pem)
    with _client(handler, client_auth=auth) as client:
        result = client.establish(EstablishRequest(applicationAnchor="my-app"))

    assert result.exposureKey == "ek"
    scheme, _, jwt = captured["auth"].partition(" ")
    assert scheme == "SudomimusClientJWT"
    claims = json.loads(decode_base64url(jwt.split(".")[1]))
    assert claims["iss"] == "my-app"
    assert claims["aud"] == "sudomimus-connect"
    assert claims["exp"] - claims["iat"] == 30
    assert claims["body_sha256"] == sha256_base64(captured["raw"])


def test_establish_with_byo_signer() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["Authorization"] == "SudomimusClientJWT fixed.jwt.value"
        return httpx.Response(
            200,
            json={"applicationAnchor": "my-app", "exposureKey": "ek", "hiddenKey": "hk"},
        )

    auth = ConnectClientAuthWithSigner(
        application_anchor="my-app", signer=lambda _raw: "fixed.jwt.value"
    )
    with _client(handler, client_auth=auth) as client:
        client.establish(EstablishRequest(applicationAnchor="my-app"))


def test_status_poll_realized_variant() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"status": "REALIZED", "confirmationKey": "ck"})

    with _client(handler) as client:
        result = client.status_poll(StatusPollRequest(exposureKey="ek", hiddenKey="hk"))
    assert result.root.status == "REALIZED"
    assert result.root.confirmationKey == "ck"


def test_redeem_happy_path() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "applicationAnchor": "my-app",
                "refreshToken": "r.t",
                "accessToken": "a.t",
            },
        )

    with _client(handler) as client:
        result = client.redeem(
            RedeemRequest(exposureKey="ek", hiddenKey="hk", confirmationKey="ck")
        )
    assert result.accessToken == "a.t"


def test_introspect_sends_no_client_auth() -> None:
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["auth"] = request.headers.get("Authorization")
        captured["path"] = request.url.path
        return httpx.Response(200, json={"status": "active", "recommendedRecheckSeconds": 30})

    with _client(handler) as client:
        result = client.introspect(IntrospectRequest(accessToken="a.t"))

    assert result.status == "active"
    assert result.recommendedRecheckSeconds == 30
    assert captured["path"] == "/introspect"
    assert captured["auth"] is None


def test_logout_revokes_session() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/logout"
        return httpx.Response(200, json={"revoked": True})

    with _client(handler) as client:
        result = client.logout(LogoutRequest(refreshToken="r.t"))
    assert result.revoked is True


def test_revoke_all_requires_client_auth() -> None:
    with _client(lambda r: httpx.Response(200)) as client, pytest.raises(ConnectConfigError):
        client.revoke_all(RevokeAllRequest(accountIdentifier="acct-1"))


def test_revoke_all_signs_request_with_matching_body_hash() -> None:
    private_pem, _ = _keypair()
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["auth"] = request.headers["Authorization"]
        captured["raw"] = request.content.decode("utf-8")
        captured["path"] = request.url.path
        return httpx.Response(200, json={"revokedCount": 2})

    auth = ConnectClientAuthWithKey(application_anchor="my-app", private_key_pem=private_pem)
    with _client(handler, client_auth=auth) as client:
        result = client.revoke_all(RevokeAllRequest(accountIdentifier="acct-1"))

    assert result.revokedCount == 2
    assert captured["path"] == "/revoke-all"
    scheme, _, jwt = captured["auth"].partition(" ")
    assert scheme == "SudomimusClientJWT"
    claims = json.loads(decode_base64url(jwt.split(".")[1]))
    assert claims["iss"] == "my-app"
    assert claims["body_sha256"] == sha256_base64(captured["raw"])


def test_error_with_reason() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"reason": "ClientJwtInvalid"})

    auth = ConnectClientAuthWithSigner(application_anchor="my-app", signer=lambda _: "x.y.z")
    with _client(handler, client_auth=auth) as client, pytest.raises(ConnectApiError) as exc:
        client.establish(EstablishRequest(applicationAnchor="my-app"))
    assert exc.value.status == 401
    assert exc.value.reason == "ClientJwtInvalid"


def test_error_with_empty_body() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, content=b"")

    with _client(handler) as client, pytest.raises(ConnectApiError) as exc:
        client.refresh(RefreshRequest(refreshToken="r.t"))
    assert exc.value.reason is None


def test_get_application_public_key_caches() -> None:
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(
            200,
            json={
                "applicationAnchor": "my-app",
                "applicationName": "My App",
                "applicationPublicKey": "PEM",
            },
        )

    with _client(handler) as client:
        assert client.get_application_public_key("my-app") == "PEM"
        assert client.get_application_public_key("my-app") == "PEM"
        assert calls["n"] == 1
        assert client.get_application_public_key("my-app", force=True) == "PEM"
        assert calls["n"] == 2
        client.clear_public_key_cache("my-app")
        client.get_application_public_key("my-app")
        assert calls["n"] == 3


def test_verify_access_token_end_to_end() -> None:
    private_pem, public_pem = _keypair()
    jwt = create_jwt(
        {"kty": "Access", "aud": "my-app", "iat": int(time.time()), "exp": int(time.time()) + 60},
        {"accountIdentifier": "acct-1", "firstName": "Ada"},
        private_pem,
    )

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "applicationAnchor": "my-app",
                "applicationName": "My App",
                "applicationPublicKey": public_pem,
            },
        )

    with _client(handler) as client:
        token = client.verify_access_token(jwt)
    assert token.body.accountIdentifier == "acct-1"


def test_async_redeem_and_info() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/info":
            return httpx.Response(
                200,
                json={
                    "applicationAnchor": "my-app",
                    "applicationName": "My App",
                    "applicationPublicKey": "PEM",
                },
            )
        return httpx.Response(
            200,
            json={"applicationAnchor": "my-app", "refreshToken": "r.t", "accessToken": "a.t"},
        )

    async def run() -> tuple[str, str]:
        async with AsyncConnectClient(
            http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler))
        ) as client:
            redeemed = await client.redeem(
                RedeemRequest(exposureKey="ek", hiddenKey="hk", confirmationKey="ck")
            )
            key = await client.get_application_public_key("my-app")
            return redeemed.accessToken, key

    access_token, public_key = asyncio.run(run())
    assert access_token == "a.t"
    assert public_key == "PEM"


def test_async_establish_with_async_signer() -> None:
    async def signer(_raw: str) -> str:
        return "async.signed.jwt"

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["Authorization"] == "SudomimusClientJWT async.signed.jwt"
        return httpx.Response(
            200,
            json={"applicationAnchor": "my-app", "exposureKey": "ek", "hiddenKey": "hk"},
        )

    auth = ConnectClientAuthWithSigner(application_anchor="my-app", signer=signer)

    async def run() -> str:
        async with AsyncConnectClient(
            http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
            client_auth=auth,
        ) as client:
            result = await client.establish(EstablishRequest(applicationAnchor="my-app"))
            return result.exposureKey

    assert asyncio.run(run()) == "ek"


def test_async_logout_and_revoke_all() -> None:
    private_pem, _ = _keypair()

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/logout":
            assert request.headers.get("Authorization") is None
            return httpx.Response(200, json={"revoked": True})
        assert request.url.path == "/revoke-all"
        assert request.headers["Authorization"].startswith("SudomimusClientJWT ")
        return httpx.Response(200, json={"revokedCount": 5})

    auth = ConnectClientAuthWithKey(application_anchor="my-app", private_key_pem=private_pem)

    async def run() -> tuple[bool, int]:
        async with AsyncConnectClient(
            http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
            client_auth=auth,
        ) as client:
            logged_out = await client.logout(LogoutRequest(refreshToken="r.t"))
            revoked = await client.revoke_all(RevokeAllRequest(accountIdentifier="acct-1"))
            return logged_out.revoked, revoked.revokedCount

    revoked, count = asyncio.run(run())
    assert revoked is True
    assert count == 5
