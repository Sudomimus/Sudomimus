package com.sudomimus.token;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.spec.RSAPublicKeySpec;
import java.util.Base64;

/** An RSA public key returned by the Session JWKS endpoint. */
@JsonIgnoreProperties(ignoreUnknown = true)
public final class ApplicationJsonWebKey {

    @JsonProperty("kty") public String keyType;
    @JsonProperty("use") public String use;
    @JsonProperty("alg") public String algorithm;
    @JsonProperty("kid") public String keyId;
    @JsonProperty("n") public String modulus;
    @JsonProperty("e") public String exponent;

    /** Converts this RSA JWK into a PKIX PEM public key accepted by the verifier. */
    public String toPublicKeyPem() {
        if (!"RSA".equals(keyType)) {
            throw new IllegalArgumentException("Unsupported JWK key type: " + keyType);
        }
        try {
            byte[] modulusBytes = Base64.getUrlDecoder().decode(modulus);
            byte[] exponentBytes = Base64.getUrlDecoder().decode(exponent);
            if (modulusBytes.length == 0 || exponentBytes.length == 0) {
                throw new IllegalArgumentException("JWK modulus and exponent must not be empty.");
            }
            RSAPublicKeySpec spec = new RSAPublicKeySpec(
                    new BigInteger(1, modulusBytes),
                    new BigInteger(1, exponentBytes));
            byte[] encoded = KeyFactory.getInstance("RSA").generatePublic(spec).getEncoded();
            String body = Base64.getMimeEncoder(64, "\n".getBytes(StandardCharsets.US_ASCII))
                    .encodeToString(encoded);
            return "-----BEGIN PUBLIC KEY-----\n" + body + "\n-----END PUBLIC KEY-----\n";
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("Unable to convert RSA JWK.", e);
        }
    }
}
