package com.sudomimus.token;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.time.Instant;
import java.util.Base64;

/**
 * A parsed Sudomimus OIDC {@code id_token}. Unlike Sudomimus access/refresh
 * tokens (whose envelope claims live in the JWT header), an id_token is a
 * standard OIDC JWT: every claim lives in the body and the token is signed by
 * the <b>platform</b> key (resolve it from the OIDC JWKS by the header
 * {@code kid}), not by an application's signing key. {@link #verify} therefore
 * checks {@code exp} from the body.
 */
public final class IdToken {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Base64.Decoder B64URL = Base64.getUrlDecoder();
    private static final String PEM_HEADER = "-----BEGIN PUBLIC KEY-----";
    private static final String PEM_FOOTER = "-----END PUBLIC KEY-----";

    private final String raw;
    private final byte[] signingInput;
    private final byte[] signature;
    private final IdTokenHeader header;
    private final IdTokenBody body;

    IdToken(String raw, byte[] signingInput, byte[] signature, IdTokenHeader header, IdTokenBody body) {
        this.raw = raw;
        this.signingInput = signingInput;
        this.signature = signature;
        this.header = header;
        this.body = body;
    }

    public String getRaw() { return raw; }
    public IdTokenHeader getHeader() { return header; }
    public IdTokenBody getBody() { return body; }

    /** Returns true when the RSA-SHA256 signature matches the given PEM-encoded public key. */
    public boolean verifySignature(String publicKeyPem) {
        try {
            PublicKey pub = parseRsaPublicKey(publicKeyPem);
            Signature sig = Signature.getInstance("SHA256withRSA");
            sig.initVerify(pub);
            sig.update(signingInput);
            return sig.verify(signature);
        } catch (Exception e) {
            return false;
        }
    }

    /** Parse an id_token into its header and body without verifying it. */
    public static IdToken parse(String jwt) {
        if (jwt == null || jwt.isEmpty()) {
            throw new TokenException(TokenErrorCode.INVALID_JWT, "Token is empty.");
        }
        String[] parts = jwt.split("\\.", -1);
        if (parts.length != 3) {
            throw new TokenException(TokenErrorCode.INVALID_JWT,
                    "Token must have exactly three dot-separated segments; got " + parts.length + ".");
        }

        IdTokenHeader header = decodeJson(parts[0], IdTokenHeader.class, "header");
        IdTokenBody body = decodeJson(parts[1], IdTokenBody.class, "body");

        byte[] signature;
        try {
            signature = B64URL.decode(parts[2]);
        } catch (IllegalArgumentException e) {
            throw new TokenException(TokenErrorCode.INVALID_JWT,
                    "Failed to decode id_token signature segment: " + e.getMessage(), e);
        }

        byte[] signingInput = (parts[0] + "." + parts[1]).getBytes(StandardCharsets.UTF_8);
        return new IdToken(jwt, signingInput, signature, header, body);
    }

    /**
     * Verify an OIDC id_token against a platform public key (resolved from the
     * OIDC JWKS). Checks the body {@code exp}, the RS256 signature, and any of
     * the supplied audience/issuer/nonce expectations.
     */
    public static IdToken verify(String jwt, String platformPublicKeyPem, IdTokenExpectations expectations) {
        IdToken parsed = parse(jwt);
        IdTokenExpectations expect = expectations != null ? expectations : new IdTokenExpectations();
        Instant now = expect.now != null ? expect.now : Instant.now();

        if (parsed.body.expiresAt == null
                || !now.isBefore(Instant.ofEpochSecond(parsed.body.expiresAt))) {
            throw new TokenException(TokenErrorCode.EXPIRED, "id_token has expired.");
        }

        if (!parsed.verifySignature(platformPublicKeyPem)) {
            throw new TokenException(TokenErrorCode.INVALID_SIGNATURE,
                    "id_token signature does not match the platform public key.");
        }

        if (expect.audience != null && !expect.audience.equals(parsed.body.audience)) {
            throw new TokenException(TokenErrorCode.WRONG_AUDIENCE,
                    "id_token aud does not match the expected client id.");
        }
        if (expect.issuer != null && !expect.issuer.equals(parsed.body.issuer)) {
            throw new TokenException(TokenErrorCode.WRONG_ISSUER,
                    "id_token iss does not match the expected issuer.");
        }
        if (expect.nonce != null && !expect.nonce.equals(parsed.body.nonce)) {
            throw new TokenException(TokenErrorCode.WRONG_NONCE,
                    "id_token nonce does not match the value sent at /authorize.");
        }

        return parsed;
    }

    private static <T> T decodeJson(String segment, Class<T> type, String label) {
        byte[] bytes;
        try {
            bytes = B64URL.decode(segment);
        } catch (IllegalArgumentException e) {
            throw new TokenException(TokenErrorCode.INVALID_JWT,
                    "Failed to decode id_token " + label + " segment: " + e.getMessage(), e);
        }
        try {
            T value = MAPPER.readValue(bytes, type);
            if (value == null) {
                throw new TokenException(TokenErrorCode.INVALID_JWT,
                        "id_token " + label + " deserialized to null.");
            }
            return value;
        } catch (TokenException e) {
            throw e;
        } catch (Exception e) {
            throw new TokenException(TokenErrorCode.INVALID_JWT,
                    "Failed to deserialize id_token " + label + ": " + e.getMessage(), e);
        }
    }

    private static PublicKey parseRsaPublicKey(String pem) throws Exception {
        String body = pem
                .replace(PEM_HEADER, "")
                .replace(PEM_FOOTER, "")
                .replaceAll("\\s+", "");
        byte[] der = Base64.getDecoder().decode(body);
        X509EncodedKeySpec spec = new X509EncodedKeySpec(der);
        return KeyFactory.getInstance("RSA").generatePublic(spec);
    }
}
