"""Synchronous Connect API HTTP client."""

from __future__ import annotations

from types import TracebackType
from typing import TypeVar

import httpx
from pydantic import BaseModel
from sudomimus_token import AccessToken, RefreshToken, TokenVerifier

from ._generated.models import (
    Error,
    EstablishRequest,
    EstablishResponse,
    HealthResponse,
    InfoRequest,
    InfoResponse,
    IntrospectRequest,
    IntrospectResponse,
    LogoutRequest,
    LogoutResponse,
    RedeemRequest,
    RedeemResponse,
    RefreshRequest,
    RefreshResponse,
    RevokeAllRequest,
    RevokeAllResponse,
    StatusPollRequest,
    StatusPollResponse,
)
from .client_auth import (
    ConnectClientAuth,
    ConnectClientAuthWithSigner,
    sign_establish_client_jwt,
)
from .constants import (
    CLIENT_JWT_AUTH_SCHEME,
    DEFAULT_PUBLIC_KEY_LOCALE,
    PRODUCTION_BASE_URL,
)
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
        public_key_fetch_locale: str = DEFAULT_PUBLIC_KEY_LOCALE,
        client_auth: ConnectClientAuth | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._client = http_client if http_client is not None else httpx.Client()
        self._owns_client = http_client is None
        self._public_key_locale = public_key_fetch_locale
        self._client_auth = client_auth
        self._public_key_cache: dict[str, str] = {}
        self._verifier = TokenVerifier(self.get_application_public_key)

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

    def refresh(self, request: RefreshRequest) -> RefreshResponse:
        return self._post("/refresh", request, RefreshResponse)

    def info(self, request: InfoRequest) -> InfoResponse:
        return self._post("/info", request, InfoResponse)

    def introspect(self, request: IntrospectRequest) -> IntrospectResponse:
        return self._post("/introspect", request, IntrospectResponse)

    def logout(self, request: LogoutRequest) -> LogoutResponse:
        return self._post("/logout", request, LogoutResponse)

    def revoke_all(self, request: RevokeAllRequest) -> RevokeAllResponse:
        return self._post_with_client_auth(
            "/revoke-all", request, RevokeAllResponse, method_name="revoke_all"
        )

    def get_application_public_key(
        self,
        application_anchor: str,
        *,
        force: bool = False,
    ) -> str:
        """Resolve (and cache) an application's PEM public key via ``/info``."""
        if not force and application_anchor in self._public_key_cache:
            return self._public_key_cache[application_anchor]
        response = self.info(
            InfoRequest(applicationAnchor=application_anchor, locale=self._public_key_locale)
        )
        self._public_key_cache[application_anchor] = response.applicationPublicKey
        return response.applicationPublicKey

    def clear_public_key_cache(self, application_anchor: str | None = None) -> None:
        if application_anchor is not None:
            self._public_key_cache.pop(application_anchor, None)
            return
        self._public_key_cache.clear()

    def verify_access_token(self, jwt: str) -> AccessToken:
        return self._verifier.verify_access_token(jwt)

    def verify_refresh_token(self, jwt: str) -> RefreshToken:
        return self._verifier.verify_refresh_token(jwt)

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
