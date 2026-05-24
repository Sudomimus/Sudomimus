"""End-to-end token verification (structure, key type, audience, expiry, signature)."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import TypeVar

from .errors import TokenError, TokenErrorCode
from .models import AccessTokenBody, RefreshTokenBody
from .parser import parse_access_token, parse_refresh_token, peek_header
from .token import JwtToken

ACCESS_TOKEN_KEY_TYPE = "Access"
REFRESH_TOKEN_KEY_TYPE = "Refresh"

PublicKeyResolver = Callable[[str], str]
AsyncPublicKeyResolver = Callable[[str], Awaitable[str]]

_BodyT = TypeVar("_BodyT", AccessTokenBody, RefreshTokenBody)


def _now_utc() -> datetime:
    return datetime.now(tz=UTC)


def _check_before_signature(
    jwt: str,
    expected_key_type: str,
    parser: Callable[[str], JwtToken[_BodyT]],
    now: datetime,
) -> tuple[JwtToken[_BodyT], str]:
    """Run every check that does not need the public key; return token + audience.

    Peek the header first so a wrong-type token surfaces as ``WRONG_KEY_TYPE``
    rather than ``INVALID_JWT`` (which is what a body-shape mismatch would
    otherwise produce — a refresh body has no ``firstName``).
    """
    peeked = peek_header(jwt)
    if peeked.kty != expected_key_type:
        raise TokenError(
            TokenErrorCode.WRONG_KEY_TYPE,
            f'Expected key type "{expected_key_type}", got "{peeked.kty or ""}".',
        )

    parsed = parser(jwt)
    audience = parsed.header.aud
    if not audience:
        raise TokenError(
            TokenErrorCode.MISSING_AUDIENCE,
            "Token is missing the `aud` (applicationAnchor) header.",
        )

    if not parsed.verify_expiration(now):
        raise TokenError(TokenErrorCode.EXPIRED, "Token has expired.")

    return parsed, audience


def _check_signature(parsed: JwtToken[_BodyT], public_key_pem: str) -> JwtToken[_BodyT]:
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

    def verify_access_token(self, jwt: str) -> JwtToken[AccessTokenBody]:
        return self._verify(jwt, ACCESS_TOKEN_KEY_TYPE, parse_access_token)

    def verify_refresh_token(self, jwt: str) -> JwtToken[RefreshTokenBody]:
        return self._verify(jwt, REFRESH_TOKEN_KEY_TYPE, parse_refresh_token)

    def _verify(
        self,
        jwt: str,
        expected_key_type: str,
        parser: Callable[[str], JwtToken[_BodyT]],
    ) -> JwtToken[_BodyT]:
        parsed, audience = _check_before_signature(
            jwt, expected_key_type, parser, self._clock()
        )
        return _check_signature(parsed, self._resolver(audience))


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

    async def verify_access_token(self, jwt: str) -> JwtToken[AccessTokenBody]:
        return await self._verify(jwt, ACCESS_TOKEN_KEY_TYPE, parse_access_token)

    async def verify_refresh_token(self, jwt: str) -> JwtToken[RefreshTokenBody]:
        return await self._verify(jwt, REFRESH_TOKEN_KEY_TYPE, parse_refresh_token)

    async def _verify(
        self,
        jwt: str,
        expected_key_type: str,
        parser: Callable[[str], JwtToken[_BodyT]],
    ) -> JwtToken[_BodyT]:
        parsed, audience = _check_before_signature(
            jwt, expected_key_type, parser, self._clock()
        )
        return _check_signature(parsed, await self._resolver(audience))
