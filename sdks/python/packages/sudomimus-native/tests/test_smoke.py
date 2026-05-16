"""Smoke tests for sudomimus_native."""

from __future__ import annotations

from sudomimus_native import NativeClient, StatusPollRequest


def test_client_normalizes_base_url() -> None:
    client = NativeClient(base_url="https://native.example.com/")
    assert client.base_url == "https://native.example.com"


def test_generated_model_round_trip() -> None:
    request = StatusPollRequest(pollToken="poll-token")
    assert request.pollToken == "poll-token"
