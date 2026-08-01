package com.sudomimus.token;

/** Categorical reason a token failed to parse or verify. */
public enum TokenErrorCode {
    INVALID_JWT,
    WRONG_TOKEN_TYPE,
    MISSING_AUDIENCE,
    MISSING_KEY_ID,
    UNKNOWN_KEY_ID,
    EXPIRED,
    INVALID_SIGNATURE,
    WRONG_AUDIENCE,
    WRONG_ISSUER,
    WRONG_NONCE,
}
