/**
 * @author Sudomimus Contributors
 * @package Connect
 * @namespace Token
 * @description Token
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

export const ACCESS_TOKEN_KEY_TYPE = "Access";
export const REFRESH_TOKEN_KEY_TYPE = "Refresh";

export const parseAccessToken = (jwt: string): AccessToken | null => {

    return JWTToken.fromTokenOrNull<AccessTokenHeader, AccessTokenBody>(jwt);
};

export const parseRefreshToken = (jwt: string): RefreshToken | null => {

    return JWTToken.fromTokenOrNull<RefreshTokenHeader, RefreshTokenBody>(jwt);
};

export type ConnectTokenErrorCode =
    | "INVALID_JWT"
    | "WRONG_KEY_TYPE"
    | "MISSING_AUDIENCE"
    | "EXPIRED"
    | "INVALID_SIGNATURE";

export class ConnectTokenError extends Error {

    public readonly code: ConnectTokenErrorCode;

    public constructor(
        code: ConnectTokenErrorCode,
        message: string,
    ) {

        super(message);
        this.name = "ConnectTokenError";
        this.code = code;
    }
}
