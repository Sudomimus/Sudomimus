"""Tests for TokenStore + RotatingConnectClient (sync + async)."""

from __future__ import annotations

import asyncio
import threading
import time
from collections.abc import Callable

import httpx
import pytest
from sudomimus_connect import (
    AsyncConnectClient,
    AsyncInMemoryTokenStore,
    AsyncRotatingConnectClient,
    ConnectApiError,
    ConnectClient,
    ConnectConfigError,
    InMemoryTokenStore,
    RotatingConnectClient,
    TokenPair,
)

Handler = Callable[[httpx.Request], httpx.Response]


def _sync_client(handler: Handler) -> ConnectClient:
    transport = httpx.MockTransport(handler)
    return ConnectClient(http_client=httpx.Client(transport=transport))


def _async_client(handler: Handler) -> AsyncConnectClient:
    transport = httpx.MockTransport(handler)
    return AsyncConnectClient(http_client=httpx.AsyncClient(transport=transport))


# ---------- InMemoryTokenStore ----------------------------------------


def test_in_memory_store_round_trip() -> None:
    store = InMemoryTokenStore()
    assert store.load() is None

    store.save(TokenPair(access_token="a1", refresh_token="r1"))
    pair = store.load()
    assert pair is not None
    assert (pair.access_token, pair.refresh_token) == ("a1", "r1")

    store.save(TokenPair(access_token="a2", refresh_token="r2"))
    pair = store.load()
    assert pair is not None
    assert (pair.access_token, pair.refresh_token) == ("a2", "r2")

    store.clear()
    assert store.load() is None


def test_in_memory_store_initial_pair() -> None:
    store = InMemoryTokenStore(TokenPair(access_token="a0", refresh_token="r0"))
    pair = store.load()
    assert pair is not None
    assert pair.refresh_token == "r0"


# ---------- AsyncInMemoryTokenStore -----------------------------------


def test_async_in_memory_store_round_trip() -> None:
    async def run() -> None:
        store = AsyncInMemoryTokenStore()
        assert await store.load() is None

        await store.save(TokenPair(access_token="a1", refresh_token="r1"))
        pair = await store.load()
        assert pair is not None
        assert (pair.access_token, pair.refresh_token) == ("a1", "r1")

        await store.clear()
        assert await store.load() is None

    asyncio.run(run())


# ---------- RotatingConnectClient (sync) -------------------------------


def test_rotating_refresh_without_seed_raises() -> None:
    rotating = RotatingConnectClient(
        _sync_client(lambda r: httpx.Response(404)), InMemoryTokenStore()
    )
    with pytest.raises(ConnectConfigError):
        rotating.refresh()


def test_rotating_seed_then_refresh_updates_store() -> None:
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["path"] = request.url.path
        captured["body"] = request.content.decode("utf-8")
        return httpx.Response(200, json={"accessToken": "a2", "refreshToken": "r2"})

    rotating = RotatingConnectClient(_sync_client(handler), InMemoryTokenStore())
    rotating.seed(TokenPair(access_token="a1", refresh_token="r1"))

    assert rotating.get_access_token() == "a1"

    new_access = rotating.refresh()
    assert new_access == "a2"
    assert captured["path"] == "/refresh"
    assert "r1" in captured["body"]

    pair = rotating.get_tokens()
    assert pair is not None
    assert (pair.access_token, pair.refresh_token) == ("a2", "r2")


def test_rotating_logout_revokes_and_clears() -> None:
    seen: dict = {"refresh_seen_in_body": None}

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/logout"
        seen["refresh_seen_in_body"] = "r1" in request.content.decode("utf-8")
        return httpx.Response(200, json={"revoked": True})

    rotating = RotatingConnectClient(_sync_client(handler), InMemoryTokenStore())
    rotating.seed(TokenPair(access_token="a1", refresh_token="r1"))

    rotating.logout()
    assert seen["refresh_seen_in_body"] is True
    assert rotating.get_tokens() is None


def test_rotating_logout_clears_even_on_server_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"reason": "ServerExploded"})

    rotating = RotatingConnectClient(_sync_client(handler), InMemoryTokenStore())
    rotating.seed(TokenPair(access_token="a1", refresh_token="r1"))

    with pytest.raises(ConnectApiError):
        rotating.logout()

    # Store still cleared despite server failure — local cleanup unconditional.
    assert rotating.get_tokens() is None


def test_rotating_logout_noop_when_empty() -> None:
    def handler(request: httpx.Request) -> httpx.Response:  # pragma: no cover - never hit
        raise AssertionError("network should not be touched when store is empty")

    rotating = RotatingConnectClient(_sync_client(handler), InMemoryTokenStore())
    rotating.logout()


def test_rotating_concurrent_refresh_coalesces() -> None:
    """Two threads racing /refresh share one in-flight call."""
    call_count = {"n": 0}
    gate = threading.Event()

    def handler(request: httpx.Request) -> httpx.Response:
        # Block until the second thread has also entered refresh(). The
        # first arrival should be the only request the second thread sees
        # the result of (in-flight de-dup); the handler runs exactly once.
        gate.wait(timeout=2.0)
        call_count["n"] += 1
        return httpx.Response(200, json={"accessToken": "a2", "refreshToken": "r2"})

    rotating = RotatingConnectClient(_sync_client(handler), InMemoryTokenStore())
    rotating.seed(TokenPair(access_token="a1", refresh_token="r1"))

    results: list[str] = []
    errors: list[BaseException] = []

    def worker() -> None:
        try:
            results.append(rotating.refresh())
        except BaseException as exc:  # noqa: BLE001
            errors.append(exc)

    threads = [threading.Thread(target=worker) for _ in range(2)]
    for thread in threads:
        thread.start()

    # Give both threads a chance to enter refresh() and find the in-flight
    # slot. 50ms is generous on any modern machine.
    time.sleep(0.05)
    gate.set()

    for thread in threads:
        thread.join(timeout=2.0)

    assert errors == []
    assert results == ["a2", "a2"]
    assert call_count["n"] == 1


# ---------- AsyncRotatingConnectClient ---------------------------------


def test_async_rotating_seed_then_refresh_updates_store() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"accessToken": "a2", "refreshToken": "r2"})

    async def run() -> tuple[str, TokenPair | None]:
        async with _async_client(handler) as client:
            rotating = AsyncRotatingConnectClient(client, AsyncInMemoryTokenStore())
            await rotating.seed(TokenPair(access_token="a1", refresh_token="r1"))
            new_access = await rotating.refresh()
            pair = await rotating.get_tokens()
            return new_access, pair

    new_access, pair = asyncio.run(run())
    assert new_access == "a2"
    assert pair is not None
    assert (pair.access_token, pair.refresh_token) == ("a2", "r2")


def test_async_rotating_refresh_without_seed_raises() -> None:
    def handler(request: httpx.Request) -> httpx.Response:  # pragma: no cover - never hit
        raise AssertionError("should not be reached")

    async def run() -> None:
        async with _async_client(handler) as client:
            rotating = AsyncRotatingConnectClient(client, AsyncInMemoryTokenStore())
            await rotating.refresh()

    with pytest.raises(ConnectConfigError):
        asyncio.run(run())


def test_async_rotating_concurrent_refresh_coalesces() -> None:
    """Concurrent ``refresh()`` on the same instance hits ``/refresh`` once."""
    call_count = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        call_count["n"] += 1
        return httpx.Response(200, json={"accessToken": "a2", "refreshToken": "r2"})

    async def run() -> list[str]:
        async with _async_client(handler) as client:
            rotating = AsyncRotatingConnectClient(client, AsyncInMemoryTokenStore())
            await rotating.seed(TokenPair(access_token="a1", refresh_token="r1"))
            return await asyncio.gather(rotating.refresh(), rotating.refresh(), rotating.refresh())

    results = asyncio.run(run())
    assert results == ["a2", "a2", "a2"]
    assert call_count["n"] == 1


def test_async_rotating_logout_revokes_and_clears() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/logout"
        return httpx.Response(200, json={"revoked": True})

    async def run() -> TokenPair | None:
        async with _async_client(handler) as client:
            rotating = AsyncRotatingConnectClient(client, AsyncInMemoryTokenStore())
            await rotating.seed(TokenPair(access_token="a1", refresh_token="r1"))
            await rotating.logout()
            return await rotating.get_tokens()

    assert asyncio.run(run()) is None
