"""Django views backed by the Sudomimus framework integration."""

import os

from django.http import HttpRequest, HttpResponse
from django.shortcuts import render
from django.urls import path
from sudomimus_connect import ConnectClient, ConnectClientAuthWithKey
from sudomimus_django import ConnectDjango, DjangoLoginConfig, MemoryDjangoCredentialStore
from sudomimus_session import SessionClient


def env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Set {name} before starting this example")
    return value


anchor = env("SUDOMIMUS_APPLICATION_ANCHOR")
integration = ConnectDjango(
    DjangoLoginConfig(
        application_anchor=anchor,
        callback_url="http://localhost:8000/auth/callback",
        after_login_url="/",
        after_logout_url="/",
    ),
    ConnectClient(
        client_auth=ConnectClientAuthWithKey(
            application_anchor=anchor,
            private_key_pem=env("SUDOMIMUS_PRIVATE_KEY_PEM"),
        )
    ),
    SessionClient(),
    MemoryDjangoCredentialStore(),
)


def home(request: HttpRequest) -> HttpResponse:
    current = integration.current(request)
    return render(request, "home.html", {"subject": current["subject"] if current else None})


urlpatterns = [
    path("", home),
    path("auth/start", integration.start),
    path("auth/callback", integration.callback),
    path("auth/logout", integration.logout),
]
