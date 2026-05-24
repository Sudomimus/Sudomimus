"""Synchronous Native API HTTP client."""

from __future__ import annotations

from types import TracebackType
from typing import TypeVar

import httpx
from pydantic import BaseModel

from ._generated.models import (
    DirectIssueAccessKeyRequest,
    DirectIssueAccessKeyResponse,
    DirectIssueSteamTicketRequest,
    DirectIssueSteamTicketResponse,
    Error,
)
from .constants import PRODUCTION_BASE_URL
from .errors import NativeApiError

_ResponseT = TypeVar("_ResponseT", bound=BaseModel)

_JSON_HEADERS = {"Content-Type": "application/json", "Accept": "application/json"}


class NativeClient:
    """Client for the Sudomimus Native API.

    The Native API is unauthenticated at the transport layer — the Steam
    ticket or access-key credential in the request body is the credential.
    """

    def __init__(
        self,
        base_url: str = PRODUCTION_BASE_URL,
        *,
        http_client: httpx.Client | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._client = http_client if http_client is not None else httpx.Client()
        self._owns_client = http_client is None

    @property
    def base_url(self) -> str:
        return self._base_url

    def __enter__(self) -> NativeClient:
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        self.close()

    def close(self) -> None:
        """Close the underlying HTTP client if this instance created it."""
        if self._owns_client:
            self._client.close()

    def direct_issue_steam_ticket(
        self,
        request: DirectIssueSteamTicketRequest,
    ) -> DirectIssueSteamTicketResponse:
        """Exchange a Steam Web API auth ticket for application tokens."""
        return self._post(
            "/direct-issue/steam-ticket", request, DirectIssueSteamTicketResponse
        )

    def direct_issue_access_key(
        self,
        request: DirectIssueAccessKeyRequest,
    ) -> DirectIssueAccessKeyResponse:
        """Exchange an access-key credential for application tokens."""
        return self._post(
            "/direct-issue/access-key", request, DirectIssueAccessKeyResponse
        )

    def _post(
        self,
        path: str,
        request: BaseModel,
        response_model: type[_ResponseT],
    ) -> _ResponseT:
        raw = request.model_dump_json(exclude_none=True)
        response = self._client.post(
            f"{self._base_url}{path}",
            content=raw,
            headers=_JSON_HEADERS,
        )
        return _handle(response, response_model)


def _handle(response: httpx.Response, response_model: type[_ResponseT]) -> _ResponseT:
    if response.is_success:
        return response_model.model_validate_json(response.content)
    error = _try_read_error(response)
    raise NativeApiError(response.status_code, error.reason if error else None, error)


def _try_read_error(response: httpx.Response) -> Error | None:
    if not response.content:
        return None
    try:
        return Error.model_validate_json(response.content)
    except ValueError:
        return None
