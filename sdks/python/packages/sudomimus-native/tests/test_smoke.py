"""Tests for sudomimus_native."""

from __future__ import annotations

import asyncio
import json
from collections.abc import Callable
from pathlib import Path

import httpx
import pytest
from pydantic import ValidationError
from sudomimus_native import (
    PRODUCTION_BASE_URL,
    AgreementAcceptance,
    AsyncNativeClient,
    CreateErrandRequest,
    DirectIssueAccessKeyRequest,
    DirectIssueDeniedError,
    DirectIssuePublicKeyRequest,
    DirectIssueSteamTicketConflictError,
    DirectIssueSteamTicketRequest,
    NativeApiError,
    NativeClient,
    NativeError,
    PublicKeyCredential,
    Status,
)

Handler = Callable[[httpx.Request], httpx.Response]
ACCESS_KEY_IDENTIFIER = "acs_k_11111111-1111-4111-8111-111111111111"
ACCESS_KEY_SECRET = "acs_t_" + ("0" * 64)
TERMS = json.loads((Path(__file__).resolve().parents[4] / "fixtures/native-terms.json").read_text())


def _client(handler: Handler) -> NativeClient:
    return NativeClient(http_client=httpx.Client(transport=httpx.MockTransport(handler)))


def _token_response(request: httpx.Request) -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "applicationAnchor": "my-app",
            "accessToken": "a.b.c",
            "refreshToken": "d.e.f",
            "claims": {
                "email": {"requirement": "OFF", "state": "UNKNOWN"},
                "firstName": {"requirement": "OFF", "state": "UNKNOWN"},
                "lastName": {"requirement": "OFF", "state": "UNKNOWN"},
                "avatar": {"requirement": "OFF", "state": "UNKNOWN"},
                "avatarAnimation": {"requirement": "OFF", "state": "UNKNOWN"},
            },
        },
    )


def test_base_url_normalized() -> None:
    client = NativeClient(base_url="https://native.example.com/")
    assert client.base_url == "https://native.example.com"


def test_default_base_url_is_production() -> None:
    assert NativeClient().base_url == PRODUCTION_BASE_URL


def test_direct_issue_steam_ticket() -> None:
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["body"] = json.loads(request.content)
        return _token_response(request)

    with _client(handler) as client:
        result = client.direct_issue_steam_ticket(
            DirectIssueSteamTicketRequest(
                applicationAnchor="my-app", steamTicketHex="deadbeef", steamAppId=480
            )
        )

    assert captured["url"].endswith("/direct-issue/steam-ticket")
    assert captured["body"] == {
        "applicationAnchor": "my-app",
        "steamTicketHex": "deadbeef",
        "steamAppId": 480,
    }
    assert result.accessToken == "a.b.c"
    assert result.refreshToken == "d.e.f"


def test_steam_terms_challenge_and_revision_conflict() -> None:
    checksum = TERMS["steamChallenge"]["agreement"]["locales"]["zh-CN"]["contentSha256"]

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        if "agreementAcceptance" not in body:
            assert body["steamTicketHex"] == "abcd"
            return httpx.Response(403, json=TERMS["steamChallenge"])

        assert body["steamTicketHex"] == "ef01"
        assert body["agreementAcceptance"] == {
            "revision": 2, "locale": "zh-CN", "contentSha256": checksum, "confirmed": True,
        }
        return httpx.Response(409, json=TERMS["steamConflict"])

    with _client(handler) as client:
        with pytest.raises(NativeApiError) as refused:
            client.direct_issue_steam_ticket(
                DirectIssueSteamTicketRequest(
                    applicationAnchor="my-app", steamTicketHex="abcd", steamAppId=480,
                )
            )
        denial = refused.value.body
        assert isinstance(denial, DirectIssueDeniedError)
        assert denial.agreement is not None
        locale = denial.agreement.locales.zh_CN
        assert locale.document.sections[0].paragraphs == ["Read these terms."]

        with pytest.raises(NativeApiError) as conflict:
            client.direct_issue_steam_ticket(
                DirectIssueSteamTicketRequest(
                    applicationAnchor="my-app",
                    steamTicketHex="ef01",
                    steamAppId=480,
                    agreementAcceptance=AgreementAcceptance(
                        revision=denial.agreement.requiredRevision,
                        locale="zh-CN",
                        contentSha256=locale.contentSha256,
                        confirmed=True,
                    ),
                )
            )

    assert isinstance(conflict.value.body, DirectIssueSteamTicketConflictError)
    assert conflict.value.body.requiredRevision == 3


@pytest.mark.parametrize(
    ("status", "name", "error_type"),
    [
        (409, "credentialConflict", NativeError),
        (403, "browserRequired", DirectIssueDeniedError),
    ],
)
def test_access_key_retains_its_own_error_model(status: int, name: str, error_type: type) -> None:
    with (
        _client(lambda _: httpx.Response(status, json=TERMS[name])) as client,
        pytest.raises(NativeApiError) as failure,
    ):
        client.direct_issue_access_key(
            DirectIssueAccessKeyRequest(
                applicationAnchor="my-app",
                accessKeyIdentifier=ACCESS_KEY_IDENTIFIER,
                accessKeySecret=ACCESS_KEY_SECRET,
            )
        )
    assert isinstance(failure.value.body, error_type)
    assert failure.value.body.model_dump(mode="json", exclude_none=True) == TERMS[name]


def test_direct_issue_access_key() -> None:
    with _client(_token_response) as client:
        result = client.direct_issue_access_key(
            DirectIssueAccessKeyRequest(
                applicationAnchor="my-app",
                accessKeyIdentifier=ACCESS_KEY_IDENTIFIER,
                accessKeySecret=ACCESS_KEY_SECRET,
            )
        )
    assert result.accessToken == "a.b.c"


def test_direct_issue_public_key_binds_exact_body() -> None:
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["body"] = request.content
        captured["authorization"] = request.headers["Authorization"]
        return _token_response(request)

    credential = PublicKeyCredential("pky_test", lambda _input: bytes([7]) * 64)
    with _client(handler) as client:
        result = client.direct_issue_public_key(
            DirectIssuePublicKeyRequest(applicationAnchor="my-app"), credential
        )

    assert captured["body"] == b'{"applicationAnchor":"my-app"}'
    assert captured["authorization"].startswith("SudomimusPublicKeyJWT ")
    assert result.accessToken == "a.b.c"


def test_access_key_identifier_requires_uuid_v4() -> None:
    with pytest.raises(ValidationError):
        DirectIssueAccessKeyRequest(
            applicationAnchor="my-app",
            accessKeyIdentifier="acs_k_11111111-1111-1111-8111-111111111111",
            accessKeySecret=ACCESS_KEY_SECRET,
        )


def test_error_with_reason() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"reason": "AccessKeyDirectDenied"})

    with _client(handler) as client, pytest.raises(NativeApiError) as exc:
        client.direct_issue_access_key(
            DirectIssueAccessKeyRequest(
                applicationAnchor="my-app",
                accessKeyIdentifier=ACCESS_KEY_IDENTIFIER,
                accessKeySecret=ACCESS_KEY_SECRET,
            )
        )
    assert exc.value.status == 401
    assert exc.value.reason == "AccessKeyDirectDenied"


def test_rate_limit_with_empty_body() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, content=b"")

    with _client(handler) as client, pytest.raises(NativeApiError) as exc:
        client.direct_issue_steam_ticket(
            DirectIssueSteamTicketRequest(
                applicationAnchor="my-app", steamTicketHex="ab", steamAppId=1
            )
        )
    assert exc.value.status == 429
    assert exc.value.reason is None


def test_access_key_admission_counter_unavailable() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, content=b"")

    with _client(handler) as client, pytest.raises(NativeApiError) as exc:
        client.direct_issue_access_key(
            DirectIssueAccessKeyRequest(
                applicationAnchor="my-app",
                accessKeyIdentifier=ACCESS_KEY_IDENTIFIER,
                accessKeySecret=ACCESS_KEY_SECRET,
            )
        )
    assert exc.value.status == 503
    assert exc.value.reason is None
    assert exc.value.body is None


def test_close_closes_owned_client() -> None:
    client = NativeClient()  # owns its httpx.Client
    client.close()
    assert client._client.is_closed


def test_error_with_unparseable_body() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, content=b"<html>internal error</html>")

    with _client(handler) as client, pytest.raises(NativeApiError) as exc:
        client.direct_issue_steam_ticket(
            DirectIssueSteamTicketRequest(
                applicationAnchor="my-app", steamTicketHex="ab", steamAppId=1
            )
        )
    assert exc.value.status == 500
    assert exc.value.reason is None


def test_async_direct_issue_steam_ticket() -> None:
    async def run() -> str:
        async with AsyncNativeClient(
            http_client=httpx.AsyncClient(transport=httpx.MockTransport(_token_response))
        ) as client:
            result = await client.direct_issue_steam_ticket(
                DirectIssueSteamTicketRequest(
                    applicationAnchor="my-app", steamTicketHex="ab", steamAppId=1
                )
            )
            return result.accessToken

    assert asyncio.run(run()) == "a.b.c"


def test_async_base_url_normalized_and_default() -> None:
    assert AsyncNativeClient(base_url="https://native.example.com/").base_url == (
        "https://native.example.com"
    )
    assert AsyncNativeClient().base_url == PRODUCTION_BASE_URL


def test_async_aclose_closes_owned_client() -> None:
    async def run() -> bool:
        # No http_client passed, so the client owns (and must close) its own.
        client = AsyncNativeClient()
        await client.aclose()
        return client._client.is_closed

    assert asyncio.run(run()) is True


def test_async_direct_issue_access_key() -> None:
    async def run() -> str:
        async with AsyncNativeClient(
            http_client=httpx.AsyncClient(transport=httpx.MockTransport(_token_response))
        ) as client:
            result = await client.direct_issue_access_key(
                DirectIssueAccessKeyRequest(
                    applicationAnchor="my-app",
                    accessKeyIdentifier=ACCESS_KEY_IDENTIFIER,
                    accessKeySecret=ACCESS_KEY_SECRET,
                )
            )
            return result.accessToken

    assert asyncio.run(run()) == "a.b.c"


def test_create_errand() -> None:
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "errand": {
                    "errandKey": "ernd_xyz",
                    "url": "https://via.example.com",
                    "expiresAt": "2026-06-15T21:00:00Z",
                },
                "claims": {
                    "email": {"requirement": "REQUIRED", "state": "UNKNOWN"},
                    "firstName": {"requirement": "OFF", "state": "UNKNOWN"},
                    "lastName": {"requirement": "OFF", "state": "UNKNOWN"},
                    "avatar": {"requirement": "OFF", "state": "UNKNOWN"},
                    "avatarAnimation": {"requirement": "OFF", "state": "UNKNOWN"},
                },
            },
        )

    with _client(handler) as client:
        result = client.create_errand(CreateErrandRequest(accessToken="a.b.c"))

    assert captured["url"].endswith("/errand")
    assert captured["body"] == {"accessToken": "a.b.c"}
    assert result.errand is not None
    assert result.errand.errandKey == "ernd_xyz"
    assert result.claims.email.requirement == "REQUIRED"


def test_errand_status() -> None:
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        return httpx.Response(200, json={"status": "COMPLETED"})

    with _client(handler) as client:
        result = client.errand_status("ernd_xyz")

    assert captured["url"].endswith("/errand/ernd_xyz/status")
    assert result.status is Status.COMPLETED


def test_async_create_errand() -> None:
    async def run() -> str:
        async def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                200,
                json={
                    "errand": {
                        "errandKey": "ernd_xyz",
                        "url": "https://via.example.com",
                        "expiresAt": "2026-06-15T21:00:00Z",
                    },
                    "claims": {
                        "email": {"requirement": "REQUIRED", "state": "UNKNOWN"},
                        "firstName": {"requirement": "OFF", "state": "UNKNOWN"},
                        "lastName": {"requirement": "OFF", "state": "UNKNOWN"},
                        "avatar": {"requirement": "OFF", "state": "UNKNOWN"},
                        "avatarAnimation": {"requirement": "OFF", "state": "UNKNOWN"},
                    },
                },
            )

        async with AsyncNativeClient(
            http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler))
        ) as client:
            result = await client.create_errand(CreateErrandRequest(accessToken="a.b.c"))
            assert result.errand is not None
            return result.errand.errandKey

    assert asyncio.run(run()) == "ernd_xyz"


def test_async_errand_status() -> None:
    async def run() -> str:
        async def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"status": "COMPLETED"})

        async with AsyncNativeClient(
            http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler))
        ) as client:
            result = await client.errand_status("ernd_xyz")
            return result.status

    assert asyncio.run(run()) == "COMPLETED"
