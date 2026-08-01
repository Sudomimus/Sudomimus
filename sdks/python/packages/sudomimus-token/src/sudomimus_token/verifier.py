"""End-to-end token verification (structure, media type, audience, expiry, signature)."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import TypeVar

from .errors import TokenError, TokenErrorCode
from .models import AccessTokenBody, AccessTokenHeader, RefreshTokenBody, RefreshTokenHeader
from .parser import parse_access_token, parse_refresh_token, peek_body, peek_header
from .token import JwtToken

ACCESS_TOKEN_TYPE = "vnd.sudomimus.application-access+jwt"
REFRESH_TOKEN_TYPE = "vnd.sudomimus.application-refresh+jwt"

PublicKeyResolver = Callable[[str, str], str]
AsyncPublicKeyResolver = Callable[[str, str], Awaitable[str]]

_HeaderT = TypeVar("_HeaderT", AccessTokenHeader, RefreshTokenHeader)
_BodyT = TypeVar("_BodyT", AccessTokenBody, RefreshTokenBody)


def _now_utc() -> datetime:
    return datetime.now(tz=UTC)


def _check_before_signature(
    jwt: str,
    expected_token_type: str,
    parser: Callable[[str], JwtToken[_HeaderT, _BodyT]],
    now: datetime,
) -> tuple[JwtToken[_HeaderT, _BodyT], str, str]:
    """Run every check that does not need the public key; return token + audience.

    Peek the header first so a wrong-type token surfaces as
    ``WRONG_TOKEN_TYPE`` rather than ``INVALID_JWT``.
    """
    peeked = peek_header(jwt)
    if peeked.typ != expected_token_type:
        raise TokenError(
            TokenErrorCode.WRONG_TOKEN_TYPE,
            f'Expected token type "{expected_token_type}", got "{peeked.typ or ""}".',
        )

    payload = peek_body(jwt)
    audience = payload.get("aud")
    if not isinstance(audience, str) or not audience:
        raise TokenError(
            TokenErrorCode.MISSING_AUDIENCE,
            "Token is missing the `aud` (applicationAnchor) payload claim.",
        )

    key_id = peeked.kid
    if not key_id:
        raise TokenError(
            TokenErrorCode.MISSING_KEY_ID,
            "Token is missing the `kid` signing-key identifier.",
        )

    parsed = parser(jwt)
    if not parsed.verify_expiration(now):
        raise TokenError(TokenErrorCode.EXPIRED, "Token has expired.")

    return parsed, audience, key_id


def _check_signature(
    parsed: JwtToken[_HeaderT, _BodyT], public_key_pem: str
) -> JwtToken[_HeaderT, _BodyT]:
    if not parsed.verify_signature(public_key_pem):
        raise TokenError(
            TokenErrorCode.INVALID_SIGNATURE,
            "Token signature does not match the application public key.",
        )
    return parsed


class TokenVerifier:
    """Synchronous verifier driven by a public-key resolver."""

    def __init__(
        self,
        resolver: PublicKeyResolver,
        *,
        clock: Callable[[], datetime] = _now_utc,
    ) -> None:
        self._resolver = resolver
        self._clock = clock

    def verify_access_token(self, jwt: str) -> JwtToken[AccessTokenHeader, AccessTokenBody]:
        return self._verify(jwt, ACCESS_TOKEN_TYPE, parse_access_token)

    def verify_refresh_token(self, jwt: str) -> JwtToken[RefreshTokenHeader, RefreshTokenBody]:
        return self._verify(jwt, REFRESH_TOKEN_TYPE, parse_refresh_token)

    def _verify(
        self,
        jwt: str,
        expected_token_type: str,
        parser: Callable[[str], JwtToken[_HeaderT, _BodyT]],
    ) -> JwtToken[_HeaderT, _BodyT]:
        parsed, audience, key_id = _check_before_signature(
            jwt, expected_token_type, parser, self._clock()
        )
        return _check_signature(parsed, self._resolver(audience, key_id))


class AsyncTokenVerifier:
    """Asynchronous verifier with an awaitable public-key resolver."""

    def __init__(
        self,
        resolver: AsyncPublicKeyResolver,
        *,
        clock: Callable[[], datetime] = _now_utc,
    ) -> None:
        self._resolver = resolver
        self._clock = clock

    async def verify_access_token(
        self, jwt: str
    ) -> JwtToken[AccessTokenHeader, AccessTokenBody]:
        return await self._verify(jwt, ACCESS_TOKEN_TYPE, parse_access_token)

    async def verify_refresh_token(
        self, jwt: str
    ) -> JwtToken[RefreshTokenHeader, RefreshTokenBody]:
        return await self._verify(jwt, REFRESH_TOKEN_TYPE, parse_refresh_token)

    async def _verify(
        self,
        jwt: str,
        expected_token_type: str,
        parser: Callable[[str], JwtToken[_HeaderT, _BodyT]],
    ) -> JwtToken[_HeaderT, _BodyT]:
        parsed, audience, key_id = _check_before_signature(
            jwt, expected_token_type, parser, self._clock()
        )
        return _check_signature(parsed, await self._resolver(audience, key_id))
