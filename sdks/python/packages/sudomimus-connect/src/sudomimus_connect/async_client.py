"""Asynchronous Connect API HTTP client."""

from __future__ import annotations

import inspect
from types import TracebackType
from typing import TypeVar

import httpx
from pydantic import BaseModel
from sudomimus_token import AccessToken, AsyncTokenVerifier, RefreshToken

from ._generated.models import (
    EstablishRequest,
    EstablishResponse,
    HealthResponse,
    InfoRequest,
    InfoResponse,
    RedeemRequest,
    RedeemResponse,
    RefreshRequest,
    RefreshResponse,
    StatusPollRequest,
    StatusPollResponse,
)
from .client import _JSON_HEADERS, _handle
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
from .errors import ConnectConfigError

_ResponseT = TypeVar("_ResponseT", bound=BaseModel)


class AsyncConnectClient:
    """Async client for the Sudomimus Connect API."""

    def __init__(
        self,
        base_url: str = PRODUCTION_BASE_URL,
        *,
        http_client: httpx.AsyncClient | None = None,
        public_key_fetch_locale: str = DEFAULT_PUBLIC_KEY_LOCALE,
        client_auth: ConnectClientAuth | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._client = http_client if http_client is not None else httpx.AsyncClient()
        self._owns_client = http_client is None
        self._public_key_locale = public_key_fetch_locale
        self._client_auth = client_auth
        self._public_key_cache: dict[str, str] = {}
        self._verifier = AsyncTokenVerifier(self.get_application_public_key)

    @property
    def base_url(self) -> str:
        return self._base_url

    async def __aenter__(self) -> AsyncConnectClient:
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

    async def establish(self, request: EstablishRequest) -> EstablishResponse:
        if self._client_auth is None:
            raise ConnectConfigError(
                "AsyncConnectClient.establish() requires client_auth. "
                "Pass client_auth to the AsyncConnectClient constructor."
            )

        # Serialize once: these exact bytes are what the server hashes against
        # the JWT's body_sha256 claim, so they must match the wire body.
        raw_body = request.model_dump_json(exclude_none=True)

        if isinstance(self._client_auth, ConnectClientAuthWithSigner):
            signed = self._client_auth.signer(raw_body)
            jwt = await signed if inspect.isawaitable(signed) else signed
        else:
            jwt = sign_establish_client_jwt(self._client_auth, raw_body)

        response = await self._client.post(
            f"{self._base_url}/establish",
            content=raw_body,
            headers={**_JSON_HEADERS, "Authorization": f"{CLIENT_JWT_AUTH_SCHEME} {jwt}"},
        )
        return _handle(response, EstablishResponse)

    async def status_poll(self, request: StatusPollRequest) -> StatusPollResponse:
        return await self._post("/status-poll", request, StatusPollResponse)

    async def redeem(self, request: RedeemRequest) -> RedeemResponse:
        return await self._post("/redeem", request, RedeemResponse)

    async def refresh(self, request: RefreshRequest) -> RefreshResponse:
        return await self._post("/refresh", request, RefreshResponse)

    async def info(self, request: InfoRequest) -> InfoResponse:
        return await self._post("/info", request, InfoResponse)

    async def get_application_public_key(
        self,
        application_anchor: str,
        *,
        force: bool = False,
    ) -> str:
        """Resolve (and cache) an application's PEM public key via ``/info``."""
        if not force and application_anchor in self._public_key_cache:
            return self._public_key_cache[application_anchor]
        response = await self.info(
            InfoRequest(applicationAnchor=application_anchor, locale=self._public_key_locale)
        )
        self._public_key_cache[application_anchor] = response.applicationPublicKey
        return response.applicationPublicKey

    def clear_public_key_cache(self, application_anchor: str | None = None) -> None:
        if application_anchor is not None:
            self._public_key_cache.pop(application_anchor, None)
            return
        self._public_key_cache.clear()

    async def verify_access_token(self, jwt: str) -> AccessToken:
        return await self._verifier.verify_access_token(jwt)

    async def verify_refresh_token(self, jwt: str) -> RefreshToken:
        return await self._verifier.verify_refresh_token(jwt)

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
