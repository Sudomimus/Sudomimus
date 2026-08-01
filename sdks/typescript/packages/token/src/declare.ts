/**
 * @author Sudomimus Contributors
 * @package Token
 * @namespace Declare
 * @description Token type declarations
 */

import type { ApplicationToken } from "./token.js";

export type AccessTokenHeader = {
    readonly alg: "RS256";
    readonly kid: string;
    readonly typ: "vnd.sudomimus.application-access+jwt";
};

export type AccessTokenBody = {
    readonly iss: string;
    readonly aud: string;
    /** Pairwise, application-visible user key. */
    readonly sub: string;
    /** Stable identifier of the logical application session. */
    readonly sid: string;
    /** Unique identifier of this access-token instance. */
    readonly jti: string;
    readonly iat: number;
    readonly exp: number;
};

export type RefreshTokenHeader = {
    readonly alg: "RS256";
    readonly kid: string;
    readonly typ: "vnd.sudomimus.application-refresh+jwt";
};

export type RefreshTokenBody = {
    readonly iss: string;
    readonly aud: string;
    readonly sid: string;
    readonly jti: string;
    readonly iat: number;
    readonly exp: number;
    readonly rotationVersion: number;
};

export type AccessToken = ApplicationToken<AccessTokenHeader, AccessTokenBody>;
export type RefreshToken = ApplicationToken<RefreshTokenHeader, RefreshTokenBody>;

export type PublicKeyResolver = (
    applicationAnchor: string,
    keyId: string,
) => Promise<string>;

export interface TokenVerifierOptions {
    resolver: PublicKeyResolver;
}
