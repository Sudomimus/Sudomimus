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
        return new TokenVerifier(anchor -> publicPem, clock);
    }

    @Test
    void verifyAccessToken_roundTrip() throws Exception {
        TestHelpers.RsaKeyPair keys = TestHelpers.generateRsaKeyPair();
        String jwt = TestHelpers.mintAccessToken(keys.privateKey, "anchor-1");

        TokenVerifier v = makeVerifier(keys.publicPem, null);
        JwtToken<AccessTokenBody> token = v.verifyAccessToken(jwt);

        assertEquals("acct-1", token.getBody().accountIdentifier);
        assertEquals("Ada", token.getBody().firstName);
    }

    @Test
    void verifyRefreshToken_roundTrip() throws Exception {
        TestHelpers.RsaKeyPair keys = TestHelpers.generateRsaKeyPair();
        String jwt = TestHelpers.mintRefreshToken(keys.privateKey, "anchor-1");

        TokenVerifier v = makeVerifier(keys.publicPem, null);
        JwtToken<RefreshTokenBody> token = v.verifyRefreshToken(jwt);

        assertEquals("acct-1", token.getBody().accountIdentifier);
    }

    @Test
    void verifyAccessToken_wrongKeyType() throws Exception {
        TestHelpers.RsaKeyPair keys = TestHelpers.generateRsaKeyPair();
        String jwt = TestHelpers.mintRefreshToken(keys.privateKey, "anchor-1");

        TokenVerifier v = makeVerifier(keys.publicPem, null);
        TokenException ex = assertThrows(TokenException.class, () -> v.verifyAccessToken(jwt));
        assertEquals(TokenErrorCode.WRONG_KEY_TYPE, ex.getCode());
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
        header.put("typ", "JWT");
        header.put("iat", 0L);
        header.put("exp", Long.MAX_VALUE / 2);
        header.put("kty", "Access");
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("accountIdentifier", "acct-1");
        body.put("firstName", "Ada");
        String jwt = TestHelpers.mintToken(header, body, keys.privateKey);

        TokenVerifier v = makeVerifier(keys.publicPem, null);
        TokenException ex = assertThrows(TokenException.class, () -> v.verifyAccessToken(jwt));
        assertEquals(TokenErrorCode.MISSING_AUDIENCE, ex.getCode());
    }

    @Test
    void verifyAccessToken_passesAudienceToResolver() throws Exception {
        TestHelpers.RsaKeyPair keys = TestHelpers.generateRsaKeyPair();
        String jwt = TestHelpers.mintAccessToken(keys.privateKey, "anchor-zzz");

        AtomicReference<String> observed = new AtomicReference<>();
        TokenVerifier v = new TokenVerifier(anchor -> {
            observed.set(anchor);
            return keys.publicPem;
        });
        v.verifyAccessToken(jwt);

        assertEquals("anchor-zzz", observed.get());
    }

    @Test
    void parseAccessToken_invalidJwt() {
        TokenException ex = assertThrows(TokenException.class, () -> TokenParser.parseAccessToken("not-a-jwt"));
        assertEquals(TokenErrorCode.INVALID_JWT, ex.getCode());
    }
}
