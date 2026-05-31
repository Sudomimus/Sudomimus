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
        client.revoke_all(RevokeAllRequest(subject="subject-1"))


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
        result = client.revoke_all(RevokeAllRequest(subject="subject-1"))

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
        {"subject": "subject-1", "firstName": "Ada"},
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
    assert token.body.subject == "subject-1"


def test_close_closes_owned_client() -> None:
    client = ConnectClient()  # owns its httpx.Client
    client.close()
    assert client._client.is_closed


def test_health() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/health"
        return httpx.Response(200, json={"ready": True, "service": "connect", "version": "1"})

    with _client(handler) as client:
        result = client.health()
    assert result.ready is True
    assert result.service == "connect"


def test_clear_whole_public_key_cache() -> None:
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
        client.get_application_public_key("my-app")
        client.clear_public_key_cache()  # no anchor -> clears everything
        client.get_application_public_key("my-app")
        assert calls["n"] == 2


@pytest.mark.filterwarnings("ignore::RuntimeWarning")  # guard discards the un-awaited coroutine
def test_sync_signer_returning_awaitable_raises() -> None:
    async def async_signer(_raw: str) -> str:
        return "nope"

    auth = ConnectClientAuthWithSigner(application_anchor="my-app", signer=async_signer)
    with _client(lambda r: httpx.Response(200), client_auth=auth) as client:
        with pytest.raises(ConnectConfigError):
            client.establish(EstablishRequest(applicationAnchor="my-app"))


def test_error_with_unparseable_body() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, content=b"<html>internal error</html>")

    with _client(handler) as client, pytest.raises(ConnectApiError) as exc:
        client.refresh(RefreshRequest(refreshToken="r.t"))
    assert exc.value.status == 500
    assert exc.value.reason is None


def test_verify_refresh_token_end_to_end() -> None:
    private_pem, public_pem = _keypair()
    jwt = create_jwt(
        {"kty": "Refresh", "aud": "my-app", "iat": int(time.time()), "exp": int(time.time()) + 60},
        {"subject": "subject-1"},
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
        token = client.verify_refresh_token(jwt)
    assert token.body.subject == "subject-1"


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
            revoked = await client.revoke_all(RevokeAllRequest(subject="subject-1"))
            return logged_out.revoked, revoked.revokedCount

    revoked, count = asyncio.run(run())
    assert revoked is True
    assert count == 5


def test_async_base_url_normalized_and_default() -> None:
    assert AsyncConnectClient(base_url="https://connect.example.com/").base_url == (
        "https://connect.example.com"
    )
    assert AsyncConnectClient().base_url == PRODUCTION_BASE_URL


def test_async_aclose_closes_owned_client() -> None:
    async def run() -> bool:
        # No http_client passed, so the client owns (and must close) its own.
        client = AsyncConnectClient()
        await client.aclose()
        return client._client.is_closed

    assert asyncio.run(run()) is True


def test_async_health_status_poll_refresh_introspect() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path == "/health":
            return httpx.Response(200, json={"ready": True, "service": "connect", "version": "1"})
        if path == "/status-poll":
            return httpx.Response(200, json={"status": "PENDING"})
        if path == "/refresh":
            return httpx.Response(200, json={"accessToken": "a2", "refreshToken": "r2"})
        if path == "/introspect":
            return httpx.Response(200, json={"status": "active", "recommendedRecheckSeconds": 15})
        return httpx.Response(404)

    async def run() -> tuple[bool, str, str, str, int]:
        async with AsyncConnectClient(
            http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler))
        ) as client:
            health = await client.health()
            poll = await client.status_poll(StatusPollRequest(exposureKey="ek", hiddenKey="hk"))
            refreshed = await client.refresh(RefreshRequest(refreshToken="r.t"))
            introspected = await client.introspect(IntrospectRequest(accessToken="a.t"))
            return (
                health.ready,
                poll.root.status,
                refreshed.accessToken,
                introspected.status,
                introspected.recommendedRecheckSeconds,
            )

    ready, status, access_token, introspect_status, recheck = asyncio.run(run())
    assert ready is True
    assert status == "PENDING"
    assert access_token == "a2"
    assert introspect_status == "active"
    assert recheck == 15


def test_async_public_key_cache_hit_and_clear() -> None:
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

    async def run() -> None:
        async with AsyncConnectClient(
            http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler))
        ) as client:
            assert await client.get_application_public_key("my-app") == "PEM"
            # Second call is served from cache — no extra request.
            assert await client.get_application_public_key("my-app") == "PEM"
            assert calls["n"] == 1
            client.clear_public_key_cache("my-app")
            await client.get_application_public_key("my-app")
            assert calls["n"] == 2
            # Clearing the whole cache forces another fetch too.
            client.clear_public_key_cache()
            await client.get_application_public_key("my-app")
            assert calls["n"] == 3

    asyncio.run(run())


def test_async_requires_client_auth_for_establish() -> None:
    transport = httpx.MockTransport(lambda r: httpx.Response(200))

    async def run() -> None:
        async with AsyncConnectClient(http_client=httpx.AsyncClient(transport=transport)) as client:
            await client.establish(EstablishRequest(applicationAnchor="my-app"))

    with pytest.raises(ConnectConfigError):
        asyncio.run(run())


def test_async_verify_access_and_refresh_token() -> None:
    private_pem, public_pem = _keypair()
    now = int(time.time())
    access_jwt = create_jwt(
        {"kty": "Access", "aud": "my-app", "iat": now, "exp": now + 60},
        {"subject": "subject-1", "firstName": "Ada"},
        private_pem,
    )
    refresh_jwt = create_jwt(
        {"kty": "Refresh", "aud": "my-app", "iat": now, "exp": now + 60},
        {"subject": "subject-1"},
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

    async def run() -> tuple[str, str]:
        async with AsyncConnectClient(
            http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler))
        ) as client:
            access = await client.verify_access_token(access_jwt)
            refresh = await client.verify_refresh_token(refresh_jwt)
            return access.body.subject, refresh.body.subject

    access_subject, refresh_subject = asyncio.run(run())
    assert access_subject == "subject-1"
    assert refresh_subject == "subject-1"
