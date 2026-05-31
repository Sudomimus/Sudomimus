package com.sudomimus.token;

import java.time.Instant;

/**
 * Optional expectations narrowing {@link IdToken#verify}. A {@code null} field
 * is not checked; a {@code null} {@link #now} defaults to {@link Instant#now()}.
 */
public final class IdTokenExpectations {

    public String audience;
    public String issuer;
    public String nonce;
    public Instant now;

    public IdTokenExpectations audience(String value) { this.audience = value; return this; }
    public IdTokenExpectations issuer(String value) { this.issuer = value; return this; }
    public IdTokenExpectations nonce(String value) { this.nonce = value; return this; }
    public IdTokenExpectations now(Instant value) { this.now = value; return this; }
}
