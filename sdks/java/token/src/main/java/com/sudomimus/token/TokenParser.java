package com.sudomimus.token;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Base64;

/**
 * Parses Sudomimus JWTs without verifying signatures. Use this when you only
 * need to read claims — for trust decisions use {@link TokenVerifier}.
 */
public final class TokenParser {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Base64.Decoder B64URL = Base64.getUrlDecoder();

    private TokenParser() {}

    /** Parse a Sudomimus access token (header + {@link AccessTokenBody}). */
    public static JwtToken<AccessTokenBody> parseAccessToken(String jwt) {
        return parse(jwt, AccessTokenBody.class);
    }

    /** Parse a Sudomimus refresh token (header + {@link RefreshTokenBody}). */
    public static JwtToken<RefreshTokenBody> parseRefreshToken(String jwt) {
        return parse(jwt, RefreshTokenBody.class);
    }

    /**
     * Decode only the header segment. Useful for inspecting the key type or
     * audience before committing to a full typed parse.
     */
    public static JwtHeader peekHeader(String jwt) {
        String[] parts = splitOrThrow(jwt);
        return decodeJson(parts[0], JwtHeader.class, "header");
    }

    private static <TBody> JwtToken<TBody> parse(String jwt, Class<TBody> bodyType) {
        String[] parts = splitOrThrow(jwt);

        JwtHeader header = decodeJson(parts[0], JwtHeader.class, "header");
        TBody body = decodeJson(parts[1], bodyType, "body");

        byte[] signature;
        try {
            signature = B64URL.decode(parts[2]);
        } catch (IllegalArgumentException e) {
            throw new TokenException(TokenErrorCode.INVALID_JWT,
                    "Failed to decode JWT signature segment: " + e.getMessage(), e);
        }

        return new JwtToken<>(
                jwt,
                JwtToken.signingInputBytes(parts[0], parts[1]),
                signature,
                header,
                body);
    }

    private static String[] splitOrThrow(String jwt) {
        if (jwt == null || jwt.isEmpty()) {
            throw new TokenException(TokenErrorCode.INVALID_JWT, "Token is empty.");
        }
        String[] parts = jwt.split("\\.", -1);
        if (parts.length != 3) {
            throw new TokenException(TokenErrorCode.INVALID_JWT,
                    "Token must have exactly three dot-separated segments; got " + parts.length + ".");
        }
        return parts;
    }

    private static <T> T decodeJson(String segment, Class<T> type, String label) {
        byte[] bytes;
        try {
            bytes = B64URL.decode(segment);
        } catch (IllegalArgumentException e) {
            throw new TokenException(TokenErrorCode.INVALID_JWT,
                    "Failed to decode JWT " + label + " segment: " + e.getMessage(), e);
        }
        try {
            T value = MAPPER.readValue(bytes, type);
            if (value == null) {
                throw new TokenException(TokenErrorCode.INVALID_JWT,
                        "JWT " + label + " deserialized to null.");
            }
            return value;
        } catch (TokenException e) {
            throw e;
        } catch (Exception e) {
            throw new TokenException(TokenErrorCode.INVALID_JWT,
                    "Failed to deserialize JWT " + label + ": " + e.getMessage(), e);
        }
    }
}
