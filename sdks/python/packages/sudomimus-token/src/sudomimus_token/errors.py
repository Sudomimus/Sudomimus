"""Token parse/verify error types."""

from __future__ import annotations

from enum import StrEnum


class TokenErrorCode(StrEnum):
    """Categorical reason a token failed to parse or verify."""

    INVALID_JWT = "INVALID_JWT"
    WRONG_KEY_TYPE = "WRONG_KEY_TYPE"
    MISSING_AUDIENCE = "MISSING_AUDIENCE"
    EXPIRED = "EXPIRED"
    INVALID_SIGNATURE = "INVALID_SIGNATURE"


class TokenError(Exception):
    """Raised by the parser and verifier on any parse/verification failure."""

    def __init__(self, code: TokenErrorCode, message: str) -> None:
        super().__init__(message)
        self.code = code
