"""Tests for sudomimus_native."""

from __future__ import annotations

import asyncio
import json
from collections.abc import Callable

import httpx
import pytest
from sudomimus_native import (
    PRODUCTION_BASE_URL,
    AsyncNativeClient,
    CreateErrandRequest,
    DirectIssueAccessKeyRequest,
    DirectIssueSteamTicketRequest,
    NativeApiError,
    NativeClient,
)

Handler = Callable[[httpx.Request], httpx.Response]


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


def test_direct_issue_access_key() -> None:
    with _client(_token_response) as client:
        result = client.direct_issue_access_key(
            DirectIssueAccessKeyRequest(
                applicationAnchor="my-app",
                accessKeyIdentifier="11111111-1111-4111-8111-111111111111",
                accessKeySecret="0" * 64,
            )
        )
    assert result.accessToken == "a.b.c"


def test_error_with_reason() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"reason": "AccessKeyDirectDenied"})

    with _client(handler) as client, pytest.raises(NativeApiError) as exc:
        client.direct_issue_access_key(
            DirectIssueAccessKeyRequest(
                applicationAnchor="my-app",
                accessKeyIdentifier="11111111-1111-4111-8111-111111111111",
                accessKeySecret="0" * 64,
            )
        )
    assert exc.value.status == 401
    assert exc.value.reason == "AccessKeyDirectDenied"


def test_error_with_empty_body() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(403, content=b"")

    with _client(handler) as client, pytest.raises(NativeApiError) as exc:
        client.direct_issue_steam_ticket(
            DirectIssueSteamTicketRequest(
                applicationAnchor="my-app", steamTicketHex="ab", steamAppId=1
            )
        )
    assert exc.value.status == 403
    assert exc.value.reason is None


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
                    accessKeyIdentifier="11111111-1111-4111-8111-111111111111",
                    accessKeySecret="0" * 64,
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
    assert result.status == "COMPLETED"


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

