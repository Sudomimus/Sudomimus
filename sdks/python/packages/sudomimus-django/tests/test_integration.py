from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from unittest.mock import Mock

import django
from django.conf import settings

if not settings.configured:
    settings.configure(
        SECRET_KEY="test-secret",
        SESSION_ENGINE="django.contrib.sessions.backends.cache",
        CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}},
        ALLOWED_HOSTS=["example.test"],
    )
    django.setup()

from django.contrib.sessions.middleware import SessionMiddleware  # noqa: E402
from django.test import RequestFactory  # noqa: E402
from sudomimus_django import (  # noqa: E402
    ConnectDjango,
    DjangoLoginConfig,
    MemoryDjangoCredentialStore,
)


def _request(method: str, path: str, session=None):
    request = getattr(RequestFactory(), method.lower())(path)
    SessionMiddleware(lambda _: None).process_request(request)
    if session is not None:
        request.session = session
    return request


def test_login_refresh_and_logout() -> None:
    connect = Mock()
    connect.establish.return_value = SimpleNamespace(exposureKey="exp_one", hiddenKey="hid_secret")
    connect.redeem.return_value = SimpleNamespace(accessToken="access-1", refreshToken="refresh-1")
    session = Mock()
    session.verify_access_token.side_effect = [
        SimpleNamespace(body=SimpleNamespace(sub="subject", exp=int(time.time()) + 1)),
        SimpleNamespace(body=SimpleNamespace(sub="subject", exp=int(time.time()) + 3600)),
    ]
    session.refresh.return_value = SimpleNamespace(accessToken="access-2", refreshToken="refresh-2")
    integration = ConnectDjango(
        DjangoLoginConfig("my-app", "https://example.test/auth/callback", "/home", "/"),
        connect,
        session,
        MemoryDjangoCredentialStore(),
    )

    start = _request("POST", "/auth/start")
    response = integration.start(start)
    assert response.status_code == 302
    assert "exposure-key=exp_one" in response["Location"]
    assert "hid_secret" not in response["Location"]

    callback = _request(
        "GET", "/auth/callback?exposure-key=exp_one&confirmation-key=cnf_one", start.session
    )
    assert integration.callback(callback).status_code == 302
    assert integration.callback(callback).status_code == 400
    connect.redeem.assert_called_once()

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(integration.current, [callback, callback]))
    assert results == [
        {"subject": "subject", "access_token": "access-2"},
        {"subject": "subject", "access_token": "access-2"},
    ]
    assert session.refresh.call_count == 1
    logout = _request("POST", "/auth/logout", callback.session)
    assert integration.logout(logout).status_code == 302
    session.logout.assert_called_once()
    assert integration.current(logout) is None
