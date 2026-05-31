/**
 * @author Sudomimus Contributors
 * @package Token
 * @namespace Declare
 * @description Token type declarations
 */

import { JWTToken } from "@sudoo/jwt";

export type AccessTokenHeader = Record<string, never>;

export type AccessTokenBody = {

    /**
     * The application-visible user identifier — the per-(account, sector)
     * "sector subject", also the OIDC `sub`. This is the value an
     * application keys its users on; the raw internal account identifier
     * never appears in a token. User-rotatable. Opaque: never parse or
     * format-validate it.
     */
    readonly subject: string;
    readonly firstName: string;
    readonly lastName?: string;

    /**
     * Verified email associated with this login. Present only when the
     * account owns a verified email: the exact email typed for email-OTP
     * logins, otherwise the account's primary email. Omitted for accounts
     * with no verified email (e.g. Steam-only or AccessKey-only).
     */
    readonly emailAddress?: string;
};

export type RefreshTokenHeader = Record<string, never>;

export type RefreshTokenBody = {

    /**
     * The application-visible sector subject (the same pairwise identifier
     * carried as the access-token body `subject`). The refresh token is a
     * JWT that leaves the system, so it must never carry the raw internal
     * account identifier. Informational only — `/refresh` resolves the
     * token by its `jti`, never by reading this body.
     */
    readonly subject: string;
};

export type AccessToken = JWTToken<AccessTokenHeader, AccessTokenBody>;
export type RefreshToken = JWTToken<RefreshTokenHeader, RefreshTokenBody>;

export type PublicKeyResolver = (applicationAnchor: string) => Promise<string>;

export interface TokenVerifierOptions {
    resolver: PublicKeyResolver;
}
