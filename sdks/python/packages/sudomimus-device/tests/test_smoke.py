"""Tests for sudomimus_device."""

from __future__ import annotations

import asyncio
import json
from collections.abc import Callable

import httpx
import pytest
from sudomimus_connect import AsyncInMemoryTokenStore, InMemoryTokenStore, TokenPair
from sudomimus_device import (
    PRODUCTION_BASE_URL,
    AsyncDeviceAuthenticator,
    AsyncDeviceClient,
    DeviceApiError,
    DeviceAuthenticator,
    DeviceAuthorizeRequest,
    DeviceAuthorizeResponse,
    DeviceClient,
    DevicePollProgress,
    DevicePollTimeoutError,
    DeviceTokenApiError,
    DeviceTokenRequest,
)

Handler = Callable[[httpx.Request], httpx.Response]
DEVICE_CODE = "dvc_" + "a" * 64


def _sync_client(handler: Handler) -> DeviceClient:
    return DeviceClient(http_client=httpx.Client(transport=httpx.MockTransport(handler)))


def _async_client(handler: Handler) -> AsyncDeviceClient:
    return AsyncDeviceClient(http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)))


def _auth_json() -> dict:
    return {
        "applicationAnchor": "my-app",
        "deviceCode": DEVICE_CODE,
        "userCode": "ABCD-1234",
        "verificationUri": "https://sudomimus.com/device",
        "verificationUriComplete": "https://sudomimus.com/device?user_code=ABCD-1234",
        "expiresIn": 600,
        "interval": 5,
    }


def _token_json() -> dict:
    return {
        "applicationAnchor": "my-app",
        "accessToken": "access.jwt",
        "refreshToken": "refresh.jwt",
        "claims": {
            "email": {"requirement": "OFF", "state": "UNKNOWN"},
            "firstName": {"requirement": "OPTIONAL", "state": "GRANTED"},
            "lastName": {"requirement": "OPTIONAL", "state": "DENIED"},
        },
    }


def test_base_url_normalized_and_default() -> None:
    assert DeviceClient(base_url="https://device.example.com/").base_url == (
        "https://device.example.com"
    )
    assert DeviceClient().base_url == PRODUCTION_BASE_URL


def test_health() -> None:
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        return httpx.Response(200, json={"ready": True, "service": "device", "version": "1.0.0"})

    with _sync_client(handler) as client:
        result = client.health()

    assert captured["url"].endswith("/health")
    assert result.ready is True


def test_device_authorize() -> None:
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["body"] = json.loads(request.content)
        return httpx.Response(200, json=_auth_json())

    with _sync_client(handler) as client:
        result = client.device_authorize(DeviceAuthorizeRequest(applicationAnchor="my-app"))

    assert captured["url"].endswith("/device-authorize")
    assert captured["body"] == {"applicationAnchor": "my-app"}
    assert result.userCode == "ABCD-1234"


def test_device_token() -> None:
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["body"] = json.loads(request.content)
        return httpx.Response(200, json=_token_json())

    with _sync_client(handler) as client:
        result = client.device_token(DeviceTokenRequest(deviceCode=DEVICE_CODE))

    assert captured["url"].endswith("/device-token")
    assert captured["body"] == {"deviceCode": DEVICE_CODE}
    assert result.accessToken == "access.jwt"


def test_device_token_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"error": "slow_down", "interval": 8})

    with _sync_client(handler) as client, pytest.raises(DeviceTokenApiError) as exc:
        client.device_token(DeviceTokenRequest(deviceCode=DEVICE_CODE))

    assert exc.value.status == 400
    assert exc.value.error == "slow_down"
    assert exc.value.interval == 8


def test_generic_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(403, json={"reason": "Layer3Denied"})

    with _sync_client(handler) as client, pytest.raises(DeviceApiError) as exc:
        client.device_authorize(DeviceAuthorizeRequest(applicationAnchor="my-app"))

    assert exc.value.status == 403
    assert exc.value.reason == "Layer3Denied"


def test_authorize_and_poll_persists_tokens() -> None:
    responses = [
        httpx.Response(200, json=_auth_json()),
        httpx.Response(400, json={"error": "authorization_pending"}),
        httpx.Response(200, json=_token_json()),
    ]
    captured_paths: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured_paths.append(request.url.path)
        return responses.pop(0)

    opened: list[str] = []
    sleeps: list[float] = []
    progress: list[DevicePollProgress] = []
    store = InMemoryTokenStore()
    auth = DeviceAuthenticator(
        _sync_client(handler),
        store=store,
        open_url=lambda url, _auth: opened.append(url),
        sleep=lambda seconds: sleeps.append(seconds),
    )

    result = auth.authorize_and_poll(
        DeviceAuthorizeRequest(applicationAnchor="my-app"),
        on_poll=progress.append,
    )

    assert result.tokens.refreshToken == "refresh.jwt"
    assert captured_paths == ["/device-authorize", "/device-token", "/device-token"]
    assert opened == ["https://sudomimus.com/device?user_code=ABCD-1234"]
    assert sleeps == [5]
    assert progress[0].error == "authorization_pending"
    pair = store.load()
    assert pair is not None
    assert (pair.access_token, pair.refresh_token) == ("access.jwt", "refresh.jwt")


def test_poll_for_token_without_store() -> None:
    responses = [
        httpx.Response(400, json={"error": "authorization_pending"}),
        httpx.Response(200, json=_token_json()),
    ]

    def handler(request: httpx.Request) -> httpx.Response:
        return responses.pop(0)

    auth = DeviceAuthenticator(_sync_client(handler), sleep=lambda _seconds: None)
    result = auth.poll_for_token(DeviceAuthorizeResponse.model_validate(_auth_json()))

    assert result.accessToken == "access.jwt"


def test_slow_down_updates_interval() -> None:
    responses = [
        httpx.Response(400, json={"error": "slow_down", "interval": 9}),
        httpx.Response(200, json=_token_json()),
    ]
    sleeps: list[float] = []

    def handler(request: httpx.Request) -> httpx.Response:
        return responses.pop(0)

    auth = DeviceAuthenticator(_sync_client(handler), sleep=sleeps.append)
    auth.poll_for_token(DeviceAuthorizeResponse.model_validate({**_auth_json(), "interval": 2}))

    assert sleeps == [9]


def test_terminal_token_error_surfaces() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"error": "access_denied"})

    auth = DeviceAuthenticator(_sync_client(handler), sleep=lambda _seconds: None)

    with pytest.raises(DeviceTokenApiError):
        auth.poll_for_token(DeviceAuthorizeResponse.model_validate(_auth_json()))


def test_poll_timeout() -> None:
    now = {"value": 1000.0}

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"error": "authorization_pending"})

    def sleep(_seconds: float) -> None:
        now["value"] = 3000.0

    auth = DeviceAuthenticator(
        _sync_client(handler),
        sleep=sleep,
        now=lambda: now["value"],
    )

    with pytest.raises(DevicePollTimeoutError):
        auth.poll_for_token(
            DeviceAuthorizeResponse.model_validate({**_auth_json(), "expiresIn": 1})
        )


def test_store_accessors() -> None:
    store = InMemoryTokenStore()
    auth = DeviceAuthenticator(_sync_client(lambda _r: httpx.Response(404)), store=store)

    assert auth.get_tokens() is None
    auth.seed(TokenPair(access_token="a1", refresh_token="r1"))
    assert auth.get_access_token() == "a1"
    pair = auth.get_tokens()
    assert pair is not None
    assert pair.refresh_token == "r1"


def test_async_client_and_authenticator() -> None:
    responses = [
        httpx.Response(200, json=_auth_json()),
        httpx.Response(400, json={"error": "authorization_pending"}),
        httpx.Response(200, json=_token_json()),
    ]

    def handler(request: httpx.Request) -> httpx.Response:
        return responses.pop(0)

    async def run() -> tuple[str, str | None]:
        store = AsyncInMemoryTokenStore()
        opened: list[str] = []
        async with _async_client(handler) as client:
            auth = AsyncDeviceAuthenticator(
                client,
                store=store,
                open_url=lambda url, _auth: opened.append(url),
                sleep=lambda _seconds: asyncio.sleep(0),
            )
            result = await auth.authorize_and_poll(
                DeviceAuthorizeRequest(applicationAnchor="my-app")
            )
            pair = await store.load()
            return result.tokens.accessToken, pair.refresh_token if pair else None

    access_token, refresh_token = asyncio.run(run())
    assert access_token == "access.jwt"
    assert refresh_token == "refresh.jwt"


def test_async_default_base_url_and_aclose() -> None:
    async def run() -> bool:
        client = AsyncDeviceClient()
        await client.aclose()
        return client._client.is_closed

    assert AsyncDeviceClient().base_url == PRODUCTION_BASE_URL
    assert asyncio.run(run()) is True
