/**
 * @author Sudomimus Contributors
 * @package Token
 * @namespace Parse
 * @description Token parsers
 */

import type {
    AccessToken,
    AccessTokenBody,
    AccessTokenHeader,
    RefreshToken,
    RefreshTokenBody,
    RefreshTokenHeader,
} from "./declare.js";
import { ApplicationToken } from "./token.js";

const isRecord = (value: unknown): value is Record<string, unknown> => {

    return typeof value === "object" && value !== null && !Array.isArray(value);
};

const hasExactKeys = (value: Record<string, unknown>, keys: ReadonlyArray<string>): boolean => {

    const actual = Object.keys(value).sort();
    const expected = [...keys].sort();
    return actual.length === expected.length
        && actual.every((key, index) => key === expected[index]);
};

const isNonEmptyString = (value: unknown): value is string => {

    return typeof value === "string" && value.length > 0;
};

const isAbsoluteUri = (value: unknown): value is string => {

    return isNonEmptyString(value)
        && /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)
        && !/\s/.test(value);
};

const isIntegerAtLeast = (value: unknown, minimum: number): value is number => {

    return typeof value === "number" && Number.isInteger(value) && value >= minimum;
};

const isAccessHeader = (value: unknown): value is AccessTokenHeader => {

    return isRecord(value)
        && hasExactKeys(value, ["alg", "kid", "typ"])
        && value.alg === "RS256"
        && isNonEmptyString(value.kid)
        && value.typ === "vnd.sudomimus.application-access+jwt";
};

const isRefreshHeader = (value: unknown): value is RefreshTokenHeader => {

    return isRecord(value)
        && hasExactKeys(value, ["alg", "kid", "typ"])
        && value.alg === "RS256"
        && isNonEmptyString(value.kid)
        && value.typ === "vnd.sudomimus.application-refresh+jwt";
};

const isAccessBody = (value: unknown): value is AccessTokenBody => {

    return isRecord(value)
        && hasExactKeys(value, ["iss", "aud", "sub", "sid", "jti", "iat", "exp"])
        && isAbsoluteUri(value.iss)
        && isNonEmptyString(value.aud)
        && isNonEmptyString(value.sub)
        && isNonEmptyString(value.sid)
        && isNonEmptyString(value.jti)
        && isIntegerAtLeast(value.iat, 0)
        && isIntegerAtLeast(value.exp, 1);
};

const isRefreshBody = (value: unknown): value is RefreshTokenBody => {

    return isRecord(value)
        && hasExactKeys(value, ["iss", "aud", "sid", "jti", "iat", "exp", "rotationVersion"])
        && isAbsoluteUri(value.iss)
        && isNonEmptyString(value.aud)
        && isNonEmptyString(value.sid)
        && isNonEmptyString(value.jti)
        && isIntegerAtLeast(value.iat, 0)
        && isIntegerAtLeast(value.exp, 1)
        && isIntegerAtLeast(value.rotationVersion, 1);
};

export const peekTokenHeader = (jwt: string): Record<string, unknown> | null => {

    const parsed = ApplicationToken.parse(jwt);
    return parsed === null || !isRecord(parsed.header) ? null : parsed.header;
};

export const peekTokenBody = (jwt: string): Record<string, unknown> | null => {

    const parsed = ApplicationToken.parse(jwt);
    return parsed === null || !isRecord(parsed.body) ? null : parsed.body;
};

export const parseAccessToken = (jwt: string): AccessToken | null => {

    const parsed = ApplicationToken.parse(jwt);
    return parsed !== null && isAccessHeader(parsed.header) && isAccessBody(parsed.body)
        ? new ApplicationToken(jwt, parsed.signingInput, parsed.signature, parsed.header, parsed.body)
        : null;
};

export const parseRefreshToken = (jwt: string): RefreshToken | null => {

    const parsed = ApplicationToken.parse(jwt);
    return parsed !== null && isRefreshHeader(parsed.header) && isRefreshBody(parsed.body)
        ? new ApplicationToken(jwt, parsed.signingInput, parsed.signature, parsed.header, parsed.body)
        : null;
};
