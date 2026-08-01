package com.sudomimus.token;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class TokenVerifierTest {

    private static TokenVerifier makeVerifier(String publicPem, Instant fixedNow) {
        Clock clock = fixedNow == null
                ? Clock.systemUTC()
                : Clock.fixed(fixedNow, ZoneOffset.UTC);
        return new TokenVerifier((anchor, keyId) -> publicPem, clock);
    }

    @Test
    void verifyAccessToken_roundTrip() throws Exception {
        TestHelpers.RsaKeyPair keys = TestHelpers.generateRsaKeyPair();
        String jwt = TestHelpers.mintAccessToken(keys.privateKey, "anchor-1");

        TokenVerifier v = makeVerifier(keys.publicPem, null);
        JwtToken<AccessTokenBody> token = v.verifyAccessToken(jwt);

        assertEquals("subject-1", token.getBody().subject);
        assertEquals("session-1", token.getBody().sessionId);
    }

    @Test
    void verifyRefreshToken_roundTrip() throws Exception {
        TestHelpers.RsaKeyPair keys = TestHelpers.generateRsaKeyPair();
        String jwt = TestHelpers.mintRefreshToken(keys.privateKey, "anchor-1");

        TokenVerifier v = makeVerifier(keys.publicPem, null);
        JwtToken<RefreshTokenBody> token = v.verifyRefreshToken(jwt);

        assertEquals("session-1", token.getBody().sessionId);
        assertEquals(1L, token.getBody().rotationVersion);
    }

    @Test
    void verifyAccessToken_wrongTokenType() throws Exception {
        TestHelpers.RsaKeyPair keys = TestHelpers.generateRsaKeyPair();
        String jwt = TestHelpers.mintRefreshToken(keys.privateKey, "anchor-1");

        TokenVerifier v = makeVerifier(keys.publicPem, null);
        TokenException ex = assertThrows(TokenException.class, () -> v.verifyAccessToken(jwt));
        assertEquals(TokenErrorCode.WRONG_TOKEN_TYPE, ex.getCode());
    }

    @Test
    void verifyAccessToken_invalidSignature() throws Exception {
        TestHelpers.RsaKeyPair signer = TestHelpers.generateRsaKeyPair();
        TestHelpers.RsaKeyPair other = TestHelpers.generateRsaKeyPair();
        String jwt = TestHelpers.mintAccessToken(signer.privateKey, "anchor-1");

        TokenVerifier v = makeVerifier(other.publicPem, null);
        TokenException ex = assertThrows(TokenException.class, () -> v.verifyAccessToken(jwt));
        assertEquals(TokenErrorCode.INVALID_SIGNATURE, ex.getCode());
    }

    @Test
    void verifyAccessToken_expired() throws Exception {
        TestHelpers.RsaKeyPair keys = TestHelpers.generateRsaKeyPair();
        String jwt = TestHelpers.mintAccessToken(keys.privateKey, "anchor-1");

        Instant future = Instant.now().plusSeconds(7200);
        TokenVerifier v = makeVerifier(keys.publicPem, future);
        TokenException ex = assertThrows(TokenException.class, () -> v.verifyAccessToken(jwt));
        assertEquals(TokenErrorCode.EXPIRED, ex.getCode());
    }

    @Test
    void verifyAccessToken_missingAudience() throws Exception {
        TestHelpers.RsaKeyPair keys = TestHelpers.generateRsaKeyPair();
        Map<String, Object> header = new LinkedHashMap<>();
        header.put("alg", "RS256");
        header.put("typ", TokenVerifier.ACCESS_TOKEN_TYPE);
        header.put("kid", "key-1");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("iss", "https://connect-api.sudomimus.com");
        body.put("sub", "subject-1");
        body.put("sid", "session-1");
        body.put("jti", "access-1");
        body.put("iat", 0L);
        body.put("exp", Long.MAX_VALUE / 2);
        String jwt = TestHelpers.mintToken(header, body, keys.privateKey);

        TokenVerifier v = makeVerifier(keys.publicPem, null);
        TokenException ex = assertThrows(TokenException.class, () -> v.verifyAccessToken(jwt));
        assertEquals(TokenErrorCode.MISSING_AUDIENCE, ex.getCode());
    }

    @Test
    void verifyAccessToken_missingKeyId() throws Exception {
        TestHelpers.RsaKeyPair keys = TestHelpers.generateRsaKeyPair();
        long now = Instant.now().getEpochSecond();
        Map<String, Object> header = new LinkedHashMap<>();
        header.put("alg", "RS256");
        header.put("typ", TokenVerifier.ACCESS_TOKEN_TYPE);
        Map<String, Object> body = Map.of(
                "iss", "https://connect-api.sudomimus.com",
                "aud", "anchor-1",
                "sub", "subject-1",
                "sid", "session-1",
                "jti", "access-1",
                "iat", now,
                "exp", now + 3600);
        String jwt = TestHelpers.mintToken(header, body, keys.privateKey);

        TokenVerifier v = makeVerifier(keys.publicPem, null);
        TokenException ex = assertThrows(TokenException.class, () -> v.verifyAccessToken(jwt));
        assertEquals(TokenErrorCode.MISSING_KEY_ID, ex.getCode());
    }

    @Test
    void verifyAccessToken_passesAudienceAndKeyIdToResolver() throws Exception {
        TestHelpers.RsaKeyPair keys = TestHelpers.generateRsaKeyPair();
        String jwt = TestHelpers.mintAccessToken(keys.privateKey, "anchor-zzz");

        AtomicReference<String> observedAnchor = new AtomicReference<>();
        AtomicReference<String> observedKeyId = new AtomicReference<>();
        TokenVerifier v = new TokenVerifier((anchor, keyId) -> {
            observedAnchor.set(anchor);
            observedKeyId.set(keyId);
            return keys.publicPem;
        });
        v.verifyAccessToken(jwt);

        assertEquals("anchor-zzz", observedAnchor.get());
        assertEquals("key-1", observedKeyId.get());
    }

    @Test
    void parseAccessToken_invalidJwt() {
        TokenException ex = assertThrows(TokenException.class, () -> TokenParser.parseAccessToken("not-a-jwt"));
        assertEquals(TokenErrorCode.INVALID_JWT, ex.getCode());
    }
}
