"""Asynchronous Session API HTTP client."""

from __future__ import annotations

import inspect
from types import TracebackType
from typing import TypeVar

import httpx
from pydantic import BaseModel

from ._generated.models import (
    HealthResponse,
    IntrospectRequest,
    IntrospectResponse,
    LogoutRequest,
    LogoutResponse,
    RefreshRequest,
    RefreshResponse,
    RevokeAllRequest,
    RevokeAllResponse,
)
from .client import _JSON_HEADERS, _handle
from .client_auth import (
    SessionClientAuth,
    SessionClientAuthWithSigner,
    sign_session_client_jwt,
)
from .constants import CLIENT_JWT_AUTH_SCHEME, PRODUCTION_BASE_URL
from .errors import SessionConfigError

_ResponseT = TypeVar("_ResponseT", bound=BaseModel)


class AsyncSessionClient:
    """Async client for the Sudomimus Session API."""

    def __init__(
        self,
        base_url: str = PRODUCTION_BASE_URL,
        *,
        http_client: httpx.AsyncClient | None = None,
        client_auth: SessionClientAuth | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._client = http_client if http_client is not None else httpx.AsyncClient()
        self._owns_client = http_client is None
        self._client_auth = client_auth

    @property
    def base_url(self) -> str:
        return self._base_url

    async def __aenter__(self) -> AsyncSessionClient:
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
            f"{self._base_url}/health", headers={"Accept": "application/json"}
        )
        return _handle(response, HealthResponse)

    async def refresh(self, request: RefreshRequest) -> RefreshResponse:
        return await self._post("/refresh", request, RefreshResponse)

    async def introspect(self, request: IntrospectRequest) -> IntrospectResponse:
        return await self._post("/introspect", request, IntrospectResponse)

    async def logout(self, request: LogoutRequest) -> LogoutResponse:
        return await self._post("/logout", request, LogoutResponse)

    async def revoke_all(self, request: RevokeAllRequest) -> RevokeAllResponse:
        return await self._post_with_client_auth(
            "/revoke-all", request, RevokeAllResponse, method_name="revoke_all"
        )

    async def _post(
        self,
        path: str,
        request: BaseModel,
        response_model: type[_ResponseT],
    ) -> _ResponseT:
        raw = request.model_dump_json(exclude_none=True)
        response = await self._client.post(
            f"{self._base_url}{path}", content=raw, headers=_JSON_HEADERS
        )
        return _handle(response, response_model)

    async def _post_with_client_auth(
        self,
        path: str,
        request: BaseModel,
        response_model: type[_ResponseT],
        *,
        method_name: str,
    ) -> _ResponseT:
        if self._client_auth is None:
            raise SessionConfigError(
                f"AsyncSessionClient.{method_name}() requires client_auth. "
                "Pass client_auth to the AsyncSessionClient constructor."
            )

        raw_body = request.model_dump_json(exclude_none=True)

        if isinstance(self._client_auth, SessionClientAuthWithSigner):
            signed = self._client_auth.signer(raw_body)
            jwt = await signed if inspect.isawaitable(signed) else signed
        else:
            jwt = sign_session_client_jwt(self._client_auth, raw_body)

        response = await self._client.post(
            f"{self._base_url}{path}",
            content=raw_body,
            headers={**_JSON_HEADERS, "Authorization": f"{CLIENT_JWT_AUTH_SCHEME} {jwt}"},
        )
        return _handle(response, response_model)
