"""Device API error types."""

from __future__ import annotations

from ._generated.models import DeviceAuthorizeResponse, DeviceTokenError, Error


class DeviceApiError(Exception):
    """Raised for generic non-2xx responses from the Device API."""

    def __init__(self, status: int, reason: str | None, body: Error | None) -> None:
        message = f"Device API error {status}: {reason}" if reason else f"Device API error {status}"
        super().__init__(message)
        self.status = status
        self.reason = reason
        self.body = body


class DeviceTokenApiError(Exception):
    """Raised for OAuth-style `/device-token` polling errors."""

    def __init__(self, status: int, body: DeviceTokenError) -> None:
        super().__init__(f"Device token error {status}: {body.error}")
        self.status = status
        self.error = body.error
        self.interval = body.interval
        self.body = body


class DevicePollTimeoutError(Exception):
    """Raised when automatic polling reaches the session deadline."""

    def __init__(self, authorization: DeviceAuthorizeResponse) -> None:
        super().__init__("Device authorization polling timed out before tokens were issued.")
        self.authorization = authorization
