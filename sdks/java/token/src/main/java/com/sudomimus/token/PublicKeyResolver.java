package com.sudomimus.token;

/**
 * Resolves an application's PEM-encoded RSA public key from its anchor and key ID.
 * Mirrors {@code @sudomimus/token}'s {@code PublicKeyResolver}.
 */
@FunctionalInterface
public interface PublicKeyResolver {

    /**
     * @param applicationAnchor the token's {@code aud} claim — typically the
     *                          issuing application's anchor.
     * @param keyId             the token's {@code kid} claim.
     * @return the PEM-encoded RSA public key.
     */
    String resolve(String applicationAnchor, String keyId) throws Exception;
}
