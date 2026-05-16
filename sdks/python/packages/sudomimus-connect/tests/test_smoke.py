"""Smoke tests for sudomimus_connect."""

from __future__ import annotations

from sudomimus_connect import ConnectClient, EstablishRequest


def test_client_normalizes_base_url() -> None:
    client = ConnectClient(base_url="https://connect.example.com/")
    assert client.base_url == "https://connect.example.com"


def test_generated_model_round_trip() -> None:
    request = EstablishRequest(
        applicationKey="app-key",
        redirectUri="https://example.com/cb",
    )
    assert request.applicationKey == "app-key"
