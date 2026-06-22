"""Synchronous Session API HTTP client."""

from __future__ import annotations

from types import TracebackType
from typing import TypeVar

import httpx
from pydantic import BaseModel

from ._generated.models import (
    Error,
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
from .client_auth import (
    SessionClientAuth,
    SessionClientAuthWithSigner,
    sign_session_client_jwt,
)
from .constants import CLIENT_JWT_AUTH_SCHEME, PRODUCTION_BASE_URL
from .errors import SessionApiError, SessionConfigError

_ResponseT = TypeVar("_ResponseT", bound=BaseModel)

_JSON_HEADERS = {"Content-Type": "application/json", "Accept": "application/json"}


class SessionClient:
    """Client for the Sudomimus Session API."""

    def __init__(
        self,
        base_url: str = PRODUCTION_BASE_URL,
        *,
        http_client: httpx.Client | None = None,
        client_auth: SessionClientAuth | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._client = http_client if http_client is not None else httpx.Client()
        self._owns_client = http_client is None
        self._client_auth = client_auth

    @property
    def base_url(self) -> str:
        return self._base_url

    def __enter__(self) -> SessionClient:
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
            f"{self._base_url}/health", headers={"Accept": "application/json"}
        )
        return _handle(response, HealthResponse)

    def refresh(self, request: RefreshRequest) -> RefreshResponse:
        return self._post("/refresh", request, RefreshResponse)

    def introspect(self, request: IntrospectRequest) -> IntrospectResponse:
        return self._post("/introspect", request, IntrospectResponse)

    def logout(self, request: LogoutRequest) -> LogoutResponse:
        return self._post("/logout", request, LogoutResponse)

    def revoke_all(self, request: RevokeAllRequest) -> RevokeAllResponse:
        return self._post_with_client_auth(
            "/revoke-all", request, RevokeAllResponse, method_name="revoke_all"
        )

    def _post(
        self,
        path: str,
        request: BaseModel,
        response_model: type[_ResponseT],
    ) -> _ResponseT:
        raw = request.model_dump_json(exclude_none=True)
        response = self._client.post(
            f"{self._base_url}{path}", content=raw, headers=_JSON_HEADERS
        )
        return _handle(response, response_model)

    def _post_with_client_auth(
        self,
        path: str,
        request: BaseModel,
        response_model: type[_ResponseT],
        *,
        method_name: str,
    ) -> _ResponseT:
        if self._client_auth is None:
            raise SessionConfigError(
                f"SessionClient.{method_name}() requires client_auth. "
                "Pass client_auth to the SessionClient constructor."
            )

        raw_body = request.model_dump_json(exclude_none=True)

        if isinstance(self._client_auth, SessionClientAuthWithSigner):
            jwt = self._client_auth.signer(raw_body)
            if not isinstance(jwt, str):
                raise SessionConfigError(
                    "client_auth.signer returned an awaitable; use AsyncSessionClient "
                    "for async signers."
                )
        else:
            jwt = sign_session_client_jwt(self._client_auth, raw_body)

        response = self._client.post(
            f"{self._base_url}{path}",
            content=raw_body,
            headers={**_JSON_HEADERS, "Authorization": f"{CLIENT_JWT_AUTH_SCHEME} {jwt}"},
        )
        return _handle(response, response_model)


def _handle(response: httpx.Response, response_model: type[_ResponseT]) -> _ResponseT:
    if response.is_success:
        return response_model.model_validate_json(response.content)
    error = _try_read_error(response)
    raise SessionApiError(response.status_code, error.reason if error else None, error)


def _try_read_error(response: httpx.Response) -> Error | None:
    if not response.content:
        return None
    try:
        return Error.model_validate_json(response.content)
    except ValueError:
        return None
