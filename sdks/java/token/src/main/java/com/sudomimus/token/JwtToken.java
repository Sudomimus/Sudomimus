package com.sudomimus.token;

import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.time.Instant;
import java.util.Base64;

/**
 * A parsed Sudomimus JWT. Keeps the raw on-wire signing input so signature
 * verification operates on the literal bytes that were signed — re-encoding
 * the deserialized header/body could introduce key-ordering or whitespace
 * drift.
 *
 * @param <TBody> the body claim shape, e.g. {@link AccessTokenBody}.
 */
public final class JwtToken<TBody> {

    private static final String PEM_HEADER = "-----BEGIN PUBLIC KEY-----";
    private static final String PEM_FOOTER = "-----END PUBLIC KEY-----";

    private final String raw;
    private final byte[] signingInput;
    private final byte[] signature;
    private final JwtHeader header;
    private final TBody body;

    JwtToken(String raw, byte[] signingInput, byte[] signature, JwtHeader header, TBody body) {
        this.raw = raw;
        this.signingInput = signingInput;
        this.signature = signature;
        this.header = header;
        this.body = body;
    }

    public String getRaw() { return raw; }
    public byte[] getSigningInput() { return signingInput.clone(); }
    public byte[] getSignature() { return signature.clone(); }
    public JwtHeader getHeader() { return header; }
    public TBody getBody() { return body; }

    /** Returns true when the token's {@code exp} claim is in the future relative to {@code now}. */
    public boolean verifyExpiration(Instant now) {
        if (header.expiresAt == null) {
            return false;
        }
        Instant expiresAt = Instant.ofEpochSecond(header.expiresAt);
        return now.isBefore(expiresAt);
    }

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

    private static PublicKey parseRsaPublicKey(String pem) throws Exception {
        String body = pem
                .replace(PEM_HEADER, "")
                .replace(PEM_FOOTER, "")
                .replaceAll("\\s+", "");
        byte[] der = Base64.getDecoder().decode(body);
        X509EncodedKeySpec spec = new X509EncodedKeySpec(der);
        return KeyFactory.getInstance("RSA").generatePublic(spec);
    }

    static byte[] signingInputBytes(String headerSeg, String bodySeg) {
        return (headerSeg + "." + bodySeg).getBytes(StandardCharsets.UTF_8);
    }
}
