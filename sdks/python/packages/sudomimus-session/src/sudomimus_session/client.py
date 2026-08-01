"""Synchronous Session API HTTP client."""

from __future__ import annotations

import re
import time
from types import TracebackType
from typing import TypeVar
from urllib.parse import quote

import httpx
from pydantic import BaseModel
from sudomimus_token import (
    AccessToken,
    RefreshToken,
    TokenError,
    TokenErrorCode,
    TokenVerifier,
    rsa_jwk_to_pem,
)

from ._generated.models import (
    ApplicationJwksResponse,
    BearerError,
    ClaimStateResponse,
    Error1,
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
from .client_auth import (
    SessionClientAuth,
    SessionClientAuthWithSigner,
    sign_session_client_jwt,
)
from .constants import CLIENT_JWT_AUTH_SCHEME, DEFAULT_JWKS_CACHE_SECONDS, PRODUCTION_BASE_URL
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
        self._jwks_cache: dict[str, tuple[float, ApplicationJwksResponse]] = {}
        self._verifier = TokenVerifier(self.resolve_application_public_key)

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

    def application_jwks(
        self, application_anchor: str, *, force: bool = False
    ) -> ApplicationJwksResponse:
        cached = self._jwks_cache.get(application_anchor)
        if not force and cached is not None and cached[0] > time.monotonic():
            return cached[1]

        encoded_anchor = quote(application_anchor, safe="")
        response = self._client.get(
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

    def resolve_application_public_key(self, application_anchor: str, key_id: str) -> str:
        jwks = self.application_jwks(application_anchor)
        key = next((candidate for candidate in jwks.keys if candidate.kid == key_id), None)
        if key is None:
            jwks = self.application_jwks(application_anchor, force=True)
            key = next((candidate for candidate in jwks.keys if candidate.kid == key_id), None)
        if key is None:
            raise TokenError(
                TokenErrorCode.UNKNOWN_KEY_ID,
                f'No application signing key matches kid "{key_id}".',
            )
        return rsa_jwk_to_pem(modulus=key.n, exponent=key.e)

    def verify_access_token(self, jwt: str) -> AccessToken:
        return self._verifier.verify_access_token(jwt)

    def verify_refresh_token(self, jwt: str) -> RefreshToken:
        return self._verifier.verify_refresh_token(jwt)

    def refresh(self, request: RefreshRequest) -> RefreshResponse:
        return self._post("/refresh", request, RefreshResponse)

    def introspect(self, request: IntrospectRequest) -> IntrospectResponse:
        return self._post("/introspect", request, IntrospectResponse)

    def userinfo(self, access_token: str) -> UserInfoResponse:
        return self._get_with_bearer("/userinfo", access_token, UserInfoResponse)

    def claim_state(self, access_token: str) -> ClaimStateResponse:
        return self._get_with_bearer("/claim-state", access_token, ClaimStateResponse)

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

    def _get_with_bearer(
        self,
        path: str,
        access_token: str,
        response_model: type[_ResponseT],
    ) -> _ResponseT:
        response = self._client.get(
            f"{self._base_url}{path}",
            headers={"Accept": "application/json", "Authorization": f"Bearer {access_token}"},
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
    reason = error.reason if isinstance(error, Error1) else None
    raise SessionApiError(response.status_code, reason, error)


def _try_read_error(response: httpx.Response) -> Error1 | BearerError | None:
    if not response.content:
        return None
    try:
        return Error1.model_validate_json(response.content)
    except ValueError:
        try:
            return BearerError.model_validate_json(response.content)
        except ValueError:
            return None


def _cache_max_age(response: httpx.Response) -> int:
    match = re.search(
        r"(?:^|,)\s*max-age=(\d+)\s*(?:,|$)",
        response.headers.get("Cache-Control", ""),
        re.I,
    )
    return int(match.group(1)) if match else DEFAULT_JWKS_CACHE_SECONDS
