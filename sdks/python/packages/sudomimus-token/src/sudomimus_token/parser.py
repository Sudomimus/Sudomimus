"""Structural JWT parsers (no signature verification)."""

from __future__ import annotations

import binascii
from typing import TypeVar

from pydantic import BaseModel, ValidationError

from ._codec import decode_base64url
from .errors import TokenError, TokenErrorCode
from .models import AccessTokenBody, JwtHeader, RefreshTokenBody
from .token import JwtToken

_ModelT = TypeVar("_ModelT", bound=BaseModel)
_BodyT = TypeVar("_BodyT", AccessTokenBody, RefreshTokenBody)


def peek_header(jwt: str) -> JwtHeader:
    """Decode and return only the header segment.

    Useful for inspecting ``kty`` or ``aud`` before a full typed parse — the
    verifier checks ``kty`` first so a wrong-type token gives a clearer error
    than a body-shape mismatch would.
    """
    header_segment = _segments(jwt)[0]
    try:
        header_bytes = decode_base64url(header_segment)
    except (binascii.Error, ValueError) as exc:
        raise TokenError(
            TokenErrorCode.INVALID_JWT, f"Failed to decode JWT header segment: {exc}"
        ) from exc
    return _validate(JwtHeader, header_bytes, "header")


def parse_access_token(jwt: str) -> JwtToken[AccessTokenBody]:
    """Parse a Sudomimus access token (header + :class:`AccessTokenBody`)."""
    return _parse(jwt, AccessTokenBody)


def parse_refresh_token(jwt: str) -> JwtToken[RefreshTokenBody]:
    """Parse a Sudomimus refresh token (header + :class:`RefreshTokenBody`)."""
    return _parse(jwt, RefreshTokenBody)


def _segments(jwt: str) -> list[str]:
    if not jwt:
        raise TokenError(TokenErrorCode.INVALID_JWT, "Token is empty.")
    parts = jwt.split(".")
    if len(parts) != 3:
        raise TokenError(
            TokenErrorCode.INVALID_JWT,
            f"Token must have exactly three dot-separated segments; got {len(parts)}.",
        )
    return parts


def _validate(model: type[_ModelT], data: bytes, label: str) -> _ModelT:
    try:
        return model.model_validate_json(data)
    except ValidationError as exc:
        raise TokenError(
            TokenErrorCode.INVALID_JWT, f"Failed to deserialize JWT {label}: {exc}"
        ) from exc


def _parse(jwt: str, body_model: type[_BodyT]) -> JwtToken[_BodyT]:
    header_segment, body_segment, signature_segment = _segments(jwt)
    try:
        header_bytes = decode_base64url(header_segment)
        body_bytes = decode_base64url(body_segment)
        signature_bytes = decode_base64url(signature_segment)
    except (binascii.Error, ValueError) as exc:
        raise TokenError(
            TokenErrorCode.INVALID_JWT, f"Failed to decode JWT segments: {exc}"
        ) from exc

    header = _validate(JwtHeader, header_bytes, "header")
    body = _validate(body_model, body_bytes, "body")
    signing_input = f"{header_segment}.{body_segment}".encode("ascii")
    return JwtToken(
        raw=jwt,
        signing_input=signing_input,
        signature=signature_bytes,
        header=header,
        body=body,
    )
