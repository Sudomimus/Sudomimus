package com.sudomimus.token;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;
import java.util.Base64;
import java.util.function.Consumer;

/**
 * Parses Sudomimus JWTs without verifying signatures. Use this when you only
 * need to read claims — for trust decisions use {@link TokenVerifier}.
 */
public final class TokenParser {

    private static final ObjectMapper MAPPER = new ObjectMapper()
            .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
    private static final Base64.Decoder B64URL = Base64.getUrlDecoder();

    private TokenParser() {}

    /** Parse a Sudomimus access token (header + {@link AccessTokenBody}). */
    public static JwtToken<AccessTokenBody> parseAccessToken(String jwt) {
        return parse(jwt, AccessTokenBody.class, TokenVerifier.ACCESS_TOKEN_TYPE,
                TokenParser::validateAccessTokenBody);
    }

    /** Parse a Sudomimus refresh token (header + {@link RefreshTokenBody}). */
    public static JwtToken<RefreshTokenBody> parseRefreshToken(String jwt) {
        return parse(jwt, RefreshTokenBody.class, TokenVerifier.REFRESH_TOKEN_TYPE,
                TokenParser::validateRefreshTokenBody);
    }

    /**
     * Decode only the header segment. Useful for inspecting the token media
     * type before committing to a full typed parse.
     */
    public static JwtHeader peekHeader(String jwt) {
        String[] parts = splitOrThrow(jwt);
        return decodeJson(parts[0], JwtHeader.class, "header");
    }

    static String peekAudience(String jwt) {
        String[] parts = splitOrThrow(jwt);
        JsonNode body = decodeJson(parts[1], JsonNode.class, "body");
        JsonNode audience = body.get("aud");
        return audience != null && audience.isTextual() ? audience.textValue() : null;
    }

    private static <TBody> JwtToken<TBody> parse(
            String jwt,
            Class<TBody> bodyType,
            String expectedTokenType,
            Consumer<TBody> validateBody) {
        String[] parts = splitOrThrow(jwt);

        JwtHeader header = decodeJson(parts[0], JwtHeader.class, "header");
        TBody body = decodeJson(parts[1], bodyType, "body");
        validateHeader(header, expectedTokenType);
        validateBody.accept(body);

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

    private static void validateHeader(JwtHeader header, String expectedTokenType) {
        if (!"RS256".equals(header.algorithm)
                || !expectedTokenType.equals(header.type)
                || isEmpty(header.keyId)) {
            invalid("JWT protected header does not match the 4.0.0 contract.");
        }
    }

    private static void validateAccessTokenBody(AccessTokenBody body) {
        if (!isAbsoluteUri(body.issuer)
                || isEmpty(body.audience)
                || isEmpty(body.subject)
                || isEmpty(body.sessionId)
                || isEmpty(body.jwtId)
                || body.issuedAt == null || body.issuedAt < 0
                || body.expiresAt == null || body.expiresAt < 1) {
            invalid("Access-token payload does not match the 4.0.0 contract.");
        }
    }

    private static void validateRefreshTokenBody(RefreshTokenBody body) {
        if (!isAbsoluteUri(body.issuer)
                || isEmpty(body.audience)
                || isEmpty(body.sessionId)
                || isEmpty(body.jwtId)
                || body.issuedAt == null || body.issuedAt < 0
                || body.expiresAt == null || body.expiresAt < 1
                || body.rotationVersion == null || body.rotationVersion < 1) {
            invalid("Refresh-token payload does not match the 4.0.0 contract.");
        }
    }

    private static boolean isAbsoluteUri(String value) {
        if (isEmpty(value)) {
            return false;
        }
        try {
            return new URI(value).isAbsolute();
        } catch (Exception ignored) {
            return false;
        }
    }

    private static boolean isEmpty(String value) {
        return value == null || value.isEmpty();
    }

    private static void invalid(String message) {
        throw new TokenException(TokenErrorCode.INVALID_JWT, message);
    }
}
