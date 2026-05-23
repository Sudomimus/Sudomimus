"""Connect API error types."""

from __future__ import annotations

from ._generated.models import Error


class ConnectApiError(Exception):
    """Raised for any non-2xx response from the Connect API.

    For ``PRIVATE`` reasons the server returns an empty body, so
    :attr:`reason` is ``None`` and only :attr:`status` carries signal.
    """

    def __init__(self, status: int, reason: str | None, body: Error | None) -> None:
        message = (
            f"Connect API error {status}: {reason}" if reason else f"Connect API error {status}"
        )
        super().__init__(message)
        self.status = status
        self.reason = reason
        self.body = body


class ConnectConfigError(Exception):
    """Raised for client-side misconfiguration (e.g. missing client-auth)."""
