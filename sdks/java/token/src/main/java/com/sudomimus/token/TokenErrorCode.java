package com.sudomimus.token;

/** Categorical reason a token failed to parse or verify. */
public enum TokenErrorCode {
    INVALID_JWT,
    WRONG_KEY_TYPE,
    MISSING_AUDIENCE,
    EXPIRED,
    INVALID_SIGNATURE,
}
