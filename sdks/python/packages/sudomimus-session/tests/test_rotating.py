"""Tests for TokenStore + RotatingSessionClient."""

from __future__ import annotations

import asyncio
from collections.abc import Callable

import httpx
import pytest
from sudomimus_session import (
    AsyncInMemoryTokenStore,
    AsyncRotatingSessionClient,
    AsyncSessionClient,
    InMemoryTokenStore,
    RotatingSessionClient,
    SessionApiError,
    SessionClient,
    SessionConfigError,
    TokenPair,
)

Handler = Callable[[httpx.Request], httpx.Response]


def _claims() -> dict[str, dict[str, str]]:
    return {
        "email": {"requirement": "OFF", "state": "UNKNOWN"},
        "firstName": {"requirement": "OFF", "state": "UNKNOWN"},
        "lastName": {"requirement": "OFF", "state": "UNKNOWN"},
        "avatar": {"requirement": "OFF", "state": "UNKNOWN"},
    }


def _sync_client(handler: Handler) -> SessionClient:
    return SessionClient(http_client=httpx.Client(transport=httpx.MockTransport(handler)))


def _async_client(handler: Handler) -> AsyncSessionClient:
    return AsyncSessionClient(http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)))


def test_in_memory_store_roundtrip() -> None:
    store = InMemoryTokenStore()
    assert store.load() is None
    store.save(TokenPair(access_token="a1", refresh_token="r1"))
    assert store.load() == TokenPair(access_token="a1", refresh_token="r1")
    store.clear()
    assert store.load() is None


def test_refresh_rotates_and_persists() -> None:
    captured: dict[str, str] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["path"] = request.url.path
        captured["body"] = request.content.decode()
        return httpx.Response(
            200,
            json={"accessToken": "a2", "refreshToken": "r2", "claims": _claims()},
        )

    store = InMemoryTokenStore(TokenPair(access_token="a1", refresh_token="r1"))
    rotating = RotatingSessionClient(_sync_client(handler), store)

    assert rotating.refresh() == "a2"
    assert store.load() == TokenPair(access_token="a2", refresh_token="r2")
    assert captured["path"] == "/refresh"
    assert "r1" in captured["body"]


def test_refresh_requires_seed() -> None:
    rotating = RotatingSessionClient(_sync_client(lambda r: httpx.Response(404)), InMemoryTokenStore())
    with pytest.raises(SessionConfigError):
        rotating.refresh()


def test_refresh_failure_does_not_persist() -> None:
    store = InMemoryTokenStore(TokenPair(access_token="a1", refresh_token="r1"))
    rotating = RotatingSessionClient(
        _sync_client(lambda r: httpx.Response(401, json={"reason": "RefreshTokenExpired"})),
        store,
    )

    with pytest.raises(SessionApiError):
        rotating.refresh()
    assert store.load() == TokenPair(access_token="a1", refresh_token="r1")


def test_logout_clears_store() -> None:
    captured: dict[str, str] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["path"] = request.url.path
        return httpx.Response(200, json={"revoked": True})

    store = InMemoryTokenStore(TokenPair(access_token="a1", refresh_token="r1"))
    rotating = RotatingSessionClient(_sync_client(handler), store)

    rotating.logout()
    assert captured["path"] == "/logout"
    assert store.load() is None


def test_async_refresh_and_logout() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/refresh":
            return httpx.Response(
                200,
                json={"accessToken": "a2", "refreshToken": "r2", "claims": _claims()},
            )
        return httpx.Response(200, json={"revoked": True})

    async def run() -> TokenPair | None:
        async with _async_client(handler) as client:
            store = AsyncInMemoryTokenStore(TokenPair(access_token="a1", refresh_token="r1"))
            rotating = AsyncRotatingSessionClient(client, store)
            assert await rotating.refresh() == "a2"
            assert await store.load() == TokenPair(access_token="a2", refresh_token="r2")
            await rotating.logout()
            return await store.load()

    assert asyncio.run(run()) is None
