/**
 * @author Sudomimus Contributors
 * @package Token
 * @namespace Declare
 * @description Token type declarations
 */

import { JWTToken } from "@sudoo/jwt";

export type AccessTokenHeader = Record<string, never>;

export type AccessTokenBody = {

    readonly accountIdentifier: string;
    readonly firstName: string;
    readonly lastName?: string;
};

export type RefreshTokenHeader = Record<string, never>;

export type RefreshTokenBody = {

    readonly accountIdentifier: string;
};

export type AccessToken = JWTToken<AccessTokenHeader, AccessTokenBody>;
export type RefreshToken = JWTToken<RefreshTokenHeader, RefreshTokenBody>;

export type PublicKeyResolver = (applicationAnchor: string) => Promise<string>;

export interface TokenVerifierOptions {
    resolver: PublicKeyResolver;
}
