"""Asynchronous Device API HTTP client."""

from __future__ import annotations

from types import TracebackType

import httpx
from pydantic import BaseModel

from ._generated.models import (
    DeviceAuthorizeRequest,
    DeviceAuthorizeResponse,
    DeviceTokenRequest,
    DeviceTokenResponse,
    HealthResponse,
)
from .client import _JSON_HEADERS, _ResponseT, _handle
from .constants import PRODUCTION_BASE_URL


class AsyncDeviceClient:
    """Async client for the Sudomimus Device API."""

    def __init__(
        self,
        base_url: str = PRODUCTION_BASE_URL,
        *,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._client = http_client if http_client is not None else httpx.AsyncClient()
        self._owns_client = http_client is None

    @property
    def base_url(self) -> str:
        return self._base_url

    async def __aenter__(self) -> AsyncDeviceClient:
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        """Close the underlying HTTP client if this instance created it."""
        if self._owns_client:
            await self._client.aclose()

    async def health(self) -> HealthResponse:
        response = await self._client.get(
            f"{self._base_url}/health",
            headers={"Accept": "application/json"},
        )
        return _handle(response, HealthResponse)

    async def device_authorize(
        self,
        request: DeviceAuthorizeRequest,
    ) -> DeviceAuthorizeResponse:
        """Start a device authorization session."""
        return await self._post("/device-authorize", request, DeviceAuthorizeResponse)

    async def device_token(
        self,
        request: DeviceTokenRequest,
    ) -> DeviceTokenResponse:
        """Poll and consume a device authorization session."""
        return await self._post("/device-token", request, DeviceTokenResponse)

    async def _post(
        self,
        path: str,
        request: BaseModel,
        response_model: type[_ResponseT],
    ) -> _ResponseT:
        raw = request.model_dump_json(exclude_none=True)
        response = await self._client.post(
            f"{self._base_url}{path}",
            content=raw,
            headers=_JSON_HEADERS,
        )
        return _handle(response, response_model)
