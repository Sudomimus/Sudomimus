package com.sudomimus.token;

import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.function.Function;

/**
 * Verifies Sudomimus access and refresh tokens end-to-end: structural
 * integrity, expected key type, audience presence, expiration, and RSA
 * signature against a caller-supplied public key.
 */
public final class TokenVerifier {

    private static final String ACCESS_KEY_TYPE = "Access";
    private static final String REFRESH_KEY_TYPE = "Refresh";

    private final PublicKeyResolver resolver;
    private final Clock clock;

    public TokenVerifier(PublicKeyResolver resolver) {
        this(resolver, Clock.systemUTC());
    }

    /**
     * @param resolver resolver for the application's PEM public key.
     * @param clock    override "now" for tests. Defaults to {@link Clock#systemUTC()}.
     */
    public TokenVerifier(PublicKeyResolver resolver, Clock clock) {
        this.resolver = Objects.requireNonNull(resolver, "resolver");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    public JwtToken<AccessTokenBody> verifyAccessToken(String jwt) {
        return verify(jwt, ACCESS_KEY_TYPE, TokenParser::parseAccessToken);
    }

    public JwtToken<RefreshTokenBody> verifyRefreshToken(String jwt) {
        return verify(jwt, REFRESH_KEY_TYPE, TokenParser::parseRefreshToken);
    }

    private <TBody> JwtToken<TBody> verify(
            String jwt,
            String expectedKeyType,
            Function<String, JwtToken<TBody>> parser) {

        // Peek header first so a wrong-type token surfaces as WRONG_KEY_TYPE
        // rather than INVALID_JWT (a refresh body has no firstName, which
        // would otherwise fail to deserialize against AccessTokenBody).
        JwtHeader peeked = TokenParser.peekHeader(jwt);
        if (!expectedKeyType.equals(peeked.keyType)) {
            throw new TokenException(TokenErrorCode.WRONG_KEY_TYPE,
                    "Expected key type \"" + expectedKeyType + "\", got \""
                            + (peeked.keyType == null ? "" : peeked.keyType) + "\".");
        }

        JwtToken<TBody> parsed = parser.apply(jwt);
        String audience = parsed.getHeader().audience;
        if (audience == null || audience.isEmpty()) {
            throw new TokenException(TokenErrorCode.MISSING_AUDIENCE,
                    "Token is missing the `aud` (applicationAnchor) header.");
        }

        if (!parsed.verifyExpiration(Instant.now(clock))) {
            throw new TokenException(TokenErrorCode.EXPIRED, "Token has expired.");
        }

        String publicKey;
        try {
            publicKey = resolver.resolve(audience);
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("PublicKeyResolver threw: " + e.getMessage(), e);
        }

        if (!parsed.verifySignature(publicKey)) {
            throw new TokenException(TokenErrorCode.INVALID_SIGNATURE,
                    "Token signature does not match the application public key.");
        }
        return parsed;
    }
}
