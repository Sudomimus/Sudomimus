"""Native API error type."""

from __future__ import annotations

from ._generated.models import DirectIssueDeniedError, Error


class NativeApiError(Exception):
    """Raised for any non-2xx response from the Native API.

    Distinguish failure modes by :attr:`status` and :attr:`reason`. All
    access-key credential failures collapse into a single opaque
    ``AccessKeyDirectDenied`` 401 reason; Steam-ticket replays surface as 409.
    For ``PRIVATE`` reasons the body is empty and :attr:`reason` is ``None``.
    """

    def __init__(
        self,
        status: int,
        reason: str | None,
        body: DirectIssueDeniedError | Error | None,
    ) -> None:
        message = f"Native API error {status}: {reason}" if reason else f"Native API error {status}"
        super().__init__(message)
        self.status = status
        self.reason = reason
        self.body = body
