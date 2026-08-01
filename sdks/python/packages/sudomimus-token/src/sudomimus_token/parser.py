"""Structural JWT parsers (no signature verification)."""

from __future__ import annotations

import binascii
import json
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

from ._codec import decode_base64url
from .errors import TokenError, TokenErrorCode
from .models import (
    AccessTokenBody,
    AccessTokenHeader,
    JwtHeader,
    RefreshTokenBody,
    RefreshTokenHeader,
)
from .token import JwtToken

_ModelT = TypeVar("_ModelT", bound=BaseModel)
_HeaderT = TypeVar("_HeaderT", AccessTokenHeader, RefreshTokenHeader)
_BodyT = TypeVar("_BodyT", AccessTokenBody, RefreshTokenBody)


def peek_header(jwt: str) -> JwtHeader:
    """Decode and return only the header segment.

    Useful for inspecting ``typ`` before a full typed parse — the verifier
    checks it first so a wrong-type token gives a clearer error
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


def parse_access_token(jwt: str) -> JwtToken[AccessTokenHeader, AccessTokenBody]:
    """Parse a Sudomimus access token (header + :class:`AccessTokenBody`)."""
    return _parse(jwt, AccessTokenHeader, AccessTokenBody)


def parse_refresh_token(jwt: str) -> JwtToken[RefreshTokenHeader, RefreshTokenBody]:
    """Parse a Sudomimus refresh token (header + :class:`RefreshTokenBody`)."""
    return _parse(jwt, RefreshTokenHeader, RefreshTokenBody)


def peek_body(jwt: str) -> dict[str, Any]:
    """Decode the payload as an untrusted mapping for pre-parse diagnostics."""
    body_segment = _segments(jwt)[1]
    try:
        body_bytes = decode_base64url(body_segment)
        value = json.loads(body_bytes)
    except (UnicodeDecodeError, ValueError) as exc:
        raise TokenError(
            TokenErrorCode.INVALID_JWT, f"Failed to decode JWT body segment: {exc}"
        ) from exc
    if not isinstance(value, dict):
        raise TokenError(TokenErrorCode.INVALID_JWT, "JWT body must be a JSON object.")
    return value


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


def _parse(
    jwt: str,
    header_model: type[_HeaderT],
    body_model: type[_BodyT],
) -> JwtToken[_HeaderT, _BodyT]:
    header_segment, body_segment, signature_segment = _segments(jwt)
    try:
        header_bytes = decode_base64url(header_segment)
        body_bytes = decode_base64url(body_segment)
        signature_bytes = decode_base64url(signature_segment)
    except (binascii.Error, ValueError) as exc:
        raise TokenError(
            TokenErrorCode.INVALID_JWT, f"Failed to decode JWT segments: {exc}"
        ) from exc

    header = _validate(header_model, header_bytes, "header")
    body = _validate(body_model, body_bytes, "body")
    signing_input = f"{header_segment}.{body_segment}".encode("ascii")
    return JwtToken(
        raw=jwt,
        signing_input=signing_input,
        signature=signature_bytes,
        header=header,
        body=body,
    )
