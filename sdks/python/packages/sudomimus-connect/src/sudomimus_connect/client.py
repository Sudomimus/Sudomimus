"""Synchronous Connect API HTTP client."""

from __future__ import annotations

from types import TracebackType
from typing import TypeVar

import httpx
from pydantic import BaseModel
from sudomimus_session import PRODUCTION_BASE_URL as SESSION_PRODUCTION_BASE_URL
from sudomimus_session import SessionClient
from sudomimus_token import AccessToken, RefreshToken

from ._generated.models import (
    Error,
    EstablishRequest,
    EstablishResponse,
    HealthResponse,
    InfoRequest,
    InfoResponse,
    RedeemRequest,
    RedeemResponse,
    StatusPollRequest,
    StatusPollResponse,
)
from .client_auth import (
    ConnectClientAuth,
    ConnectClientAuthWithSigner,
    sign_establish_client_jwt,
)
from .constants import CLIENT_JWT_AUTH_SCHEME, PRODUCTION_BASE_URL
from .errors import ConnectApiError, ConnectConfigError

_ResponseT = TypeVar("_ResponseT", bound=BaseModel)

_JSON_HEADERS = {"Content-Type": "application/json", "Accept": "application/json"}


class ConnectClient:
    """Client for the Sudomimus Connect API."""

    def __init__(
        self,
        base_url: str = PRODUCTION_BASE_URL,
        *,
        http_client: httpx.Client | None = None,
        session_base_url: str = SESSION_PRODUCTION_BASE_URL,
        client_auth: ConnectClientAuth | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._client = http_client if http_client is not None else httpx.Client()
        self._owns_client = http_client is None
        self._client_auth = client_auth
        self._session_client = SessionClient(session_base_url, http_client=self._client)

    @property
    def base_url(self) -> str:
        return self._base_url

    def __enter__(self) -> ConnectClient:
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

    def establish(self, request: EstablishRequest) -> EstablishResponse:
        return self._post_with_client_auth(
            "/establish", request, EstablishResponse, method_name="establish"
        )

    def status_poll(self, request: StatusPollRequest) -> StatusPollResponse:
        return self._post("/status-poll", request, StatusPollResponse)

    def redeem(self, request: RedeemRequest) -> RedeemResponse:
        return self._post("/redeem", request, RedeemResponse)

    def info(self, request: InfoRequest) -> InfoResponse:
        return self._post("/info", request, InfoResponse)

    def verify_access_token(self, jwt: str) -> AccessToken:
        return self._session_client.verify_access_token(jwt)

    def verify_refresh_token(self, jwt: str) -> RefreshToken:
        return self._session_client.verify_refresh_token(jwt)

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
            raise ConnectConfigError(
                f"ConnectClient.{method_name}() requires client_auth. "
                "Pass client_auth to the ConnectClient constructor."
            )

        # Serialize once: the exact bytes here are what the server hashes
        # against the JWT's body_sha256 claim, so they must match the wire body.
        raw_body = request.model_dump_json(exclude_none=True)

        if isinstance(self._client_auth, ConnectClientAuthWithSigner):
            jwt = self._client_auth.signer(raw_body)
            if not isinstance(jwt, str):
                raise ConnectConfigError(
                    "client_auth.signer returned an awaitable; use AsyncConnectClient "
                    "for async signers."
                )
        else:
            jwt = sign_establish_client_jwt(self._client_auth, raw_body)

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
    raise ConnectApiError(response.status_code, error.reason if error else None, error)


def _try_read_error(response: httpx.Response) -> Error | None:
    if not response.content:
        return None
    try:
        return Error.model_validate_json(response.content)
    except ValueError:
        return None
