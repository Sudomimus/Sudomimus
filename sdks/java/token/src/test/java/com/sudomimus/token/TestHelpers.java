package com.sudomimus.token;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Signature;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Mints compact RS256 fixtures matching the 4.0.0 token contract.
 */
final class TestHelpers {

    static final ObjectMapper MAPPER = new ObjectMapper();
    static final Base64.Encoder B64URL = Base64.getUrlEncoder().withoutPadding();

    private TestHelpers() {}

    static final class RsaKeyPair {
        final String publicPem;
        final RSAPrivateKey privateKey;
        final RSAPublicKey publicKey;

        RsaKeyPair(String publicPem, RSAPrivateKey privateKey, RSAPublicKey publicKey) {
            this.publicPem = publicPem;
            this.privateKey = privateKey;
            this.publicKey = publicKey;
        }
    }

    static RsaKeyPair generateRsaKeyPair() throws Exception {
        KeyPairGenerator gen = KeyPairGenerator.getInstance("RSA");
        gen.initialize(2048);
        KeyPair kp = gen.generateKeyPair();
        RSAPublicKey pub = (RSAPublicKey) kp.getPublic();
        RSAPrivateKey priv = (RSAPrivateKey) kp.getPrivate();
        String pem = "-----BEGIN PUBLIC KEY-----\n"
                + Base64.getMimeEncoder(64, "\n".getBytes(StandardCharsets.US_ASCII))
                        .encodeToString(pub.getEncoded())
                + "\n-----END PUBLIC KEY-----\n";
        return new RsaKeyPair(pem, priv, pub);
    }

    static String mintToken(Map<String, Object> header, Map<String, Object> body, RSAPrivateKey priv) throws Exception {
        String headerSeg = B64URL.encodeToString(MAPPER.writeValueAsBytes(header));
        String bodySeg = B64URL.encodeToString(MAPPER.writeValueAsBytes(body));
        byte[] signingInput = (headerSeg + "." + bodySeg).getBytes(StandardCharsets.UTF_8);

        Signature sig = Signature.getInstance("SHA256withRSA");
        sig.initSign(priv);
        sig.update(signingInput);
        String sigSeg = B64URL.encodeToString(sig.sign());

        return headerSeg + "." + bodySeg + "." + sigSeg;
    }

    static String mintAccessToken(RSAPrivateKey priv, String anchor) throws Exception {
        long iat = Instant.now().getEpochSecond();
        Map<String, Object> header = new LinkedHashMap<>();
        header.put("alg", "RS256");
        header.put("typ", TokenVerifier.ACCESS_TOKEN_TYPE);
        header.put("kid", "key-1");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("iss", "https://connect-api.sudomimus.com");
        body.put("aud", anchor);
        body.put("sub", "subject-1");
        body.put("sid", "session-1");
        body.put("jti", "access-1");
        body.put("iat", iat);
        body.put("exp", iat + 3600);

        return mintToken(header, body, priv);
    }

    static String mintRefreshToken(RSAPrivateKey priv, String anchor) throws Exception {
        long iat = Instant.now().getEpochSecond();
        Map<String, Object> header = new LinkedHashMap<>();
        header.put("alg", "RS256");
        header.put("typ", TokenVerifier.REFRESH_TOKEN_TYPE);
        header.put("kid", "key-1");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("iss", "https://connect-api.sudomimus.com");
        body.put("aud", anchor);
        body.put("sid", "session-1");
        body.put("jti", "refresh-1");
        body.put("iat", iat);
        body.put("exp", iat + 30L * 24 * 3600);
        body.put("rotationVersion", 1);

        return mintToken(header, body, priv);
    }
}
