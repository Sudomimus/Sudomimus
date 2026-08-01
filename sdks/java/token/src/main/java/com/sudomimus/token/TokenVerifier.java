package com.sudomimus.token;

import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.function.Function;

/**
 * Verifies Sudomimus access and refresh tokens end-to-end: structural
 * integrity, expected token media type, audience and key ID presence, expiration, and
 * RSA signature against a caller-supplied public key.
 */
public final class TokenVerifier {

    public static final String ACCESS_TOKEN_TYPE = "vnd.sudomimus.application-access+jwt";
    public static final String REFRESH_TOKEN_TYPE = "vnd.sudomimus.application-refresh+jwt";

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
        return verify(jwt, ACCESS_TOKEN_TYPE, TokenParser::parseAccessToken);
    }

    public JwtToken<RefreshTokenBody> verifyRefreshToken(String jwt) {
        return verify(jwt, REFRESH_TOKEN_TYPE, TokenParser::parseRefreshToken);
    }

    private <TBody> JwtToken<TBody> verify(
            String jwt,
            String expectedTokenType,
            Function<String, JwtToken<TBody>> parser) {

        // Peek header first so a wrong-type token surfaces as WRONG_TOKEN_TYPE.
        JwtHeader peeked = TokenParser.peekHeader(jwt);
        if (!expectedTokenType.equals(peeked.type)) {
            throw new TokenException(TokenErrorCode.WRONG_TOKEN_TYPE,
                    "Expected token type \"" + expectedTokenType + "\", got \""
                            + (peeked.type == null ? "" : peeked.type) + "\".");
        }

        String audience = TokenParser.peekAudience(jwt);
        if (audience == null || audience.isEmpty()) {
            throw new TokenException(TokenErrorCode.MISSING_AUDIENCE,
                    "Token is missing the `aud` (applicationAnchor) payload claim.");
        }
        String keyId = peeked.keyId;
        if (keyId == null || keyId.isEmpty()) {
            throw new TokenException(TokenErrorCode.MISSING_KEY_ID,
                    "Token is missing the `kid` header.");
        }

        JwtToken<TBody> parsed = parser.apply(jwt);

        if (!parsed.verifyExpiration(Instant.now(clock))) {
            throw new TokenException(TokenErrorCode.EXPIRED, "Token has expired.");
        }

        String publicKey;
        try {
            publicKey = resolver.resolve(audience, keyId);
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
