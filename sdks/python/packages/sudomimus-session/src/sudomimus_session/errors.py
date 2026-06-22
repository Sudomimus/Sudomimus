"""Error types for the Sudomimus Session SDK."""

from __future__ import annotations

import http

from ._generated.models import Error


class SessionApiError(Exception):
    """Raised when the Session API returns a non-2xx response."""

    def __init__(self, status: int, reason: str | None = None, body: Error | None = None) -> None:
        self.status = status
        self.reason = reason
        self.body = body
        phrase = http.HTTPStatus(status).phrase if status in http.HTTPStatus._value2member_map_ else ""
        suffix = f" ({reason})" if reason else ""
        super().__init__(f"Sudomimus Session API error: HTTP {status} {phrase}{suffix}".strip())


class SessionConfigError(Exception):
    """Raised when a Session client is misconfigured for the requested operation."""
