"""Synchronous Device API HTTP client."""

from __future__ import annotations

from types import TracebackType
from typing import TypeVar

import httpx
from pydantic import BaseModel

from ._generated.models import (
    DeviceAuthorizeRequest,
    DeviceAuthorizeResponse,
    DeviceTokenError,
    DeviceTokenRequest,
    DeviceTokenResponse,
    Error,
    HealthResponse,
)
from .constants import PRODUCTION_BASE_URL
from .errors import DeviceApiError, DeviceTokenApiError

_ResponseT = TypeVar("_ResponseT", bound=BaseModel)

_JSON_HEADERS = {"Content-Type": "application/json", "Accept": "application/json"}


class DeviceClient:
    """Client for the Sudomimus Device API."""

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

    def __enter__(self) -> DeviceClient:
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

    def health(self) -> HealthResponse:
        response = self._client.get(
            f"{self._base_url}/health",
            headers={"Accept": "application/json"},
        )
        return _handle(response, HealthResponse)

    def device_authorize(
        self,
        request: DeviceAuthorizeRequest,
    ) -> DeviceAuthorizeResponse:
        """Start a device authorization session."""
        return self._post("/device-authorize", request, DeviceAuthorizeResponse)

    def device_token(
        self,
        request: DeviceTokenRequest,
    ) -> DeviceTokenResponse:
        """Poll and consume a device authorization session."""
        return self._post("/device-token", request, DeviceTokenResponse)

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
    token_error = _try_read_device_token_error(response)
    if token_error is not None:
        raise DeviceTokenApiError(response.status_code, token_error)
    error = _try_read_error(response)
    raise DeviceApiError(response.status_code, error.reason if error else None, error)


def _try_read_device_token_error(response: httpx.Response) -> DeviceTokenError | None:
    if not response.content:
        return None
    try:
        return DeviceTokenError.model_validate_json(response.content)
    except ValueError:
        return None


def _try_read_error(response: httpx.Response) -> Error | None:
    if not response.content:
        return None
    try:
        return Error.model_validate_json(response.content)
    except ValueError:
        return None
