"""Asynchronous Native API HTTP client."""

from __future__ import annotations

from types import TracebackType

import httpx
from pydantic import BaseModel

from ._generated.models import (
    CreateErrandRequest,
    CreateErrandResponse,
    DirectIssueAccessKeyRequest,
    DirectIssueAccessKeyResponse,
    DirectIssueSteamTicketRequest,
    DirectIssueSteamTicketResponse,
    ErrandStatusResponse,
)
from .client import _JSON_HEADERS, _handle, _ResponseT
from .constants import PRODUCTION_BASE_URL


class AsyncNativeClient:
    """Async client for the Sudomimus Native API."""

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

    async def __aenter__(self) -> AsyncNativeClient:
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

    async def direct_issue_steam_ticket(
        self,
        request: DirectIssueSteamTicketRequest,
    ) -> DirectIssueSteamTicketResponse:
        """Exchange a Steam Web API auth ticket for application tokens."""
        return await self._post(
            "/direct-issue/steam-ticket", request, DirectIssueSteamTicketResponse
        )

    async def direct_issue_access_key(
        self,
        request: DirectIssueAccessKeyRequest,
    ) -> DirectIssueAccessKeyResponse:
        """Exchange an access-key credential for application tokens."""
        return await self._post(
            "/direct-issue/access-key", request, DirectIssueAccessKeyResponse
        )

    async def create_errand(
        self,
        request: CreateErrandRequest,
    ) -> CreateErrandResponse:
        """Proactively mint an errand for a user you already authenticated."""
        return await self._post(
            "/errand", request, CreateErrandResponse
        )

    async def errand_status(
        self,
        errand_key: str,
    ) -> ErrandStatusResponse:
        """Poll the status of an errand."""
        response = await self._client.get(
            f"{self._base_url}/errand/{errand_key}/status",
            headers={"Accept": "application/json"},
        )
        return _handle(response, ErrandStatusResponse)

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
