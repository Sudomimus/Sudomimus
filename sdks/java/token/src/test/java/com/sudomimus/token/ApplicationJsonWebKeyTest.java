package com.sudomimus.token;

import org.junit.jupiter.api.Test;

import java.math.BigInteger;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ApplicationJsonWebKeyTest {

    @Test
    void convertsRsaJwkToPem() throws Exception {
        TestHelpers.RsaKeyPair keys = TestHelpers.generateRsaKeyPair();
        ApplicationJsonWebKey jwk = new ApplicationJsonWebKey();
        jwk.keyType = "RSA";
        jwk.use = "sig";
        jwk.algorithm = "RS256";
        jwk.keyId = "key-1";
        jwk.modulus = encodeUnsigned(keys.publicKey.getModulus());
        jwk.exponent = encodeUnsigned(keys.publicKey.getPublicExponent());

        assertEquals(keys.publicPem, jwk.toPublicKeyPem());
    }

    @Test
    void rejectsNonRsaJwk() {
        ApplicationJsonWebKey jwk = new ApplicationJsonWebKey();
        jwk.keyType = "EC";
        assertThrows(IllegalArgumentException.class, jwk::toPublicKeyPem);
    }

    private static String encodeUnsigned(BigInteger value) {
        byte[] bytes = value.toByteArray();
        if (bytes.length > 1 && bytes[0] == 0) {
            byte[] unsigned = new byte[bytes.length - 1];
            System.arraycopy(bytes, 1, unsigned, 0, unsigned.length);
            bytes = unsigned;
        }
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
