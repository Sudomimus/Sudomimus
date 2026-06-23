/**
 * @author Sudomimus Contributors
 * @package Token
 * @namespace Parse
 * @description Token parsers
 */

import { JWTToken } from "@sudoo/jwt";
import type {
    AccessToken,
    AccessTokenBody,
    AccessTokenHeader,
    RefreshToken,
    RefreshTokenBody,
    RefreshTokenHeader,
} from "./declare.js";

export const parseAccessToken = (jwt: string): AccessToken | null => {

    return JWTToken.fromTokenOrNull<AccessTokenHeader, AccessTokenBody>(jwt);
};

export const parseRefreshToken = (jwt: string): RefreshToken | null => {

    return JWTToken.fromTokenOrNull<RefreshTokenHeader, RefreshTokenBody>(jwt);
};
