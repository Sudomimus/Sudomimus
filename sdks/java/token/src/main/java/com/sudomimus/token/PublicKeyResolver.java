package com.sudomimus.token;

/**
 * Resolves an application's PEM-encoded RSA public key from its anchor.
 * Mirrors {@code @sudomimus/token}'s {@code PublicKeyResolver}.
 */
@FunctionalInterface
public interface PublicKeyResolver {

    /**
     * @param applicationAnchor the token's {@code aud} claim — typically the
     *                          issuing application's anchor.
     * @return the PEM-encoded RSA public key.
     */
    String resolve(String applicationAnchor) throws Exception;
}
