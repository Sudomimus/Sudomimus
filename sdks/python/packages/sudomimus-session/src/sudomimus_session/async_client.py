"""Asynchronous Session API HTTP client."""

from __future__ import annotations

import inspect
import time
from types import TracebackType
from typing import TypeVar
from urllib.parse import quote

import httpx
from pydantic import BaseModel
from sudomimus_token import (
    AccessToken,
    AsyncTokenVerifier,
    RefreshToken,
    TokenError,
    TokenErrorCode,
    rsa_jwk_to_pem,
)

from ._generated.models import (
    ApplicationJwksResponse,
    ClaimStateResponse,
    HealthResponse,
    IntrospectRequest,
    IntrospectResponse,
    LogoutRequest,
    LogoutResponse,
    RefreshRequest,
    RefreshResponse,
    RevokeAllRequest,
    RevokeAllResponse,
    UserInfoResponse,
)
from .client import _JSON_HEADERS, _cache_max_age, _handle
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
        self._jwks_cache: dict[str, tuple[float, ApplicationJwksResponse]] = {}
        self._verifier = AsyncTokenVerifier(self.resolve_application_public_key)

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

    async def application_jwks(
        self, application_anchor: str, *, force: bool = False
    ) -> ApplicationJwksResponse:
        cached = self._jwks_cache.get(application_anchor)
        if not force and cached is not None and cached[0] > time.monotonic():
            return cached[1]

        encoded_anchor = quote(application_anchor, safe="")
        response = await self._client.get(
            f"{self._base_url}/applications/{encoded_anchor}/jwks.json",
            headers={"Accept": "application/json"},
        )
        jwks = _handle(response, ApplicationJwksResponse)
        self._jwks_cache[application_anchor] = (
            time.monotonic() + _cache_max_age(response),
            jwks,
        )
        return jwks

    def clear_jwks_cache(self, application_anchor: str | None = None) -> None:
        if application_anchor is None:
            self._jwks_cache.clear()
        else:
            self._jwks_cache.pop(application_anchor, None)

    async def resolve_application_public_key(self, application_anchor: str, key_id: str) -> str:
        jwks = await self.application_jwks(application_anchor)
        key = next((candidate for candidate in jwks.keys if candidate.kid == key_id), None)
        if key is None:
            jwks = await self.application_jwks(application_anchor, force=True)
            key = next((candidate for candidate in jwks.keys if candidate.kid == key_id), None)
        if key is None:
            raise TokenError(
                TokenErrorCode.UNKNOWN_KEY_ID,
                f'No application signing key matches kid "{key_id}".',
            )
        return rsa_jwk_to_pem(modulus=key.n, exponent=key.e)

    async def verify_access_token(self, jwt: str) -> AccessToken:
        return await self._verifier.verify_access_token(jwt)

    async def verify_refresh_token(self, jwt: str) -> RefreshToken:
        return await self._verifier.verify_refresh_token(jwt)

    async def refresh(self, request: RefreshRequest) -> RefreshResponse:
        return await self._post("/refresh", request, RefreshResponse)

    async def introspect(self, request: IntrospectRequest) -> IntrospectResponse:
        return await self._post("/introspect", request, IntrospectResponse)

    async def userinfo(self, access_token: str) -> UserInfoResponse:
        return await self._get_with_bearer("/userinfo", access_token, UserInfoResponse)

    async def claim_state(self, access_token: str) -> ClaimStateResponse:
        return await self._get_with_bearer("/claim-state", access_token, ClaimStateResponse)

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

    async def _get_with_bearer(
        self,
        path: str,
        access_token: str,
        response_model: type[_ResponseT],
    ) -> _ResponseT:
        response = await self._client.get(
            f"{self._base_url}{path}",
            headers={"Accept": "application/json", "Authorization": f"Bearer {access_token}"},
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
