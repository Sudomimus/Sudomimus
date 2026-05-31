package com.sudomimus.token;

import org.junit.jupiter.api.Test;

import java.security.interfaces.RSAPrivateKey;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class IdTokenTest {

    private static String mintIdToken(RSAPrivateKey priv, Map<String, Object> overrides) throws Exception {
        long iat = Instant.now().getEpochSecond();
        Map<String, Object> header = new LinkedHashMap<>();
        header.put("alg", "RS256");
        header.put("typ", "JWT");
        header.put("kid", "platform-1");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("iss", "https://oidc.sudomimus.com");
        body.put("sub", "subject-1");
        body.put("aud", "client-1");
        body.put("iat", iat);
        body.put("exp", iat + 3600);
        body.put("email", "ada@example.com");
        body.put("email_verified", true);
        body.put("name", "Ada Lovelace");
        body.putAll(overrides);

        return TestHelpers.mintToken(header, body, priv);
    }

    @Test
    void parse_exposesBody() throws Exception {
        TestHelpers.RsaKeyPair keys = TestHelpers.generateRsaKeyPair();
        IdToken token = IdToken.parse(mintIdToken(keys.privateKey, Map.of()));

        assertEquals("subject-1", token.getBody().subject);
        assertEquals("ada@example.com", token.getBody().email);
        assertEquals("platform-1", token.getHeader().keyId);
    }

    @Test
    void verify_happyPath() throws Exception {
        TestHelpers.RsaKeyPair keys = TestHelpers.generateRsaKeyPair();
        String jwt = mintIdToken(keys.privateKey, Map.of("nonce", "n-1"));

        IdToken token = IdToken.verify(jwt, keys.publicPem, new IdTokenExpectations()
                .audience("client-1")
                .issuer("https://oidc.sudomimus.com")
                .nonce("n-1"));

        assertEquals("subject-1", token.getBody().subject);
    }

    @Test
    void verify_expiredThrows() throws Exception {
        TestHelpers.RsaKeyPair keys = TestHelpers.generateRsaKeyPair();
        long past = Instant.now().getEpochSecond() - 10;
        String jwt = mintIdToken(keys.privateKey, Map.of("iat", past - 3600, "exp", past));

        TokenException ex = assertThrows(TokenException.class,
                () -> IdToken.verify(jwt, keys.publicPem, new IdTokenExpectations()));
        assertEquals(TokenErrorCode.EXPIRED, ex.getCode());
    }

    @Test
    void verify_wrongSignatureThrows() throws Exception {
        TestHelpers.RsaKeyPair keys = TestHelpers.generateRsaKeyPair();
        TestHelpers.RsaKeyPair other = TestHelpers.generateRsaKeyPair();
        String jwt = mintIdToken(keys.privateKey, Map.of());

        TokenException ex = assertThrows(TokenException.class,
                () -> IdToken.verify(jwt, other.publicPem, new IdTokenExpectations()));
        assertEquals(TokenErrorCode.INVALID_SIGNATURE, ex.getCode());
    }

    @Test
    void verify_wrongNonceThrows() throws Exception {
        TestHelpers.RsaKeyPair keys = TestHelpers.generateRsaKeyPair();
        String jwt = mintIdToken(keys.privateKey, Map.of("nonce", "n-1"));

        TokenException ex = assertThrows(TokenException.class,
                () -> IdToken.verify(jwt, keys.publicPem, new IdTokenExpectations().nonce("n-2")));
        assertEquals(TokenErrorCode.WRONG_NONCE, ex.getCode());
    }
}
