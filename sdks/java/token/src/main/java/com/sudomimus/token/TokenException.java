package com.sudomimus.token;

/** Thrown by {@link TokenParser} and {@link TokenVerifier} on parse or verification failure. */
public final class TokenException extends RuntimeException {

    private final TokenErrorCode code;

    public TokenException(TokenErrorCode code, String message) {
        super(message);
        this.code = code;
    }

    public TokenException(TokenErrorCode code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public TokenErrorCode getCode() {
        return code;
    }
}
