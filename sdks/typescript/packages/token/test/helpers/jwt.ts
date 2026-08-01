/**
 * @author Sudomimus Contributors
 * @package Token
 * @namespace Test_Helpers
 * @description Shared JWT test helpers
 */

import { createSign, generateKeyPairSync } from "node:crypto";
import type {
    AccessTokenBody,
    PublicKeyResolver,
    RefreshTokenBody,
} from "../../src";

export const APPLICATION_ANCHOR = "anchor-1";
export const KEY_ID = "key-1";

const base64url = (input: Buffer | string): string => {

    return Buffer.from(input).toString("base64url");
};

const mintToken = (
    privateKey: string,
    header: Record<string, unknown>,
    body: Record<string, unknown>,
): string => {

    const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(body))}`;
    const signature = createSign("RSA-SHA256").update(signingInput).sign(privateKey);
    return `${signingInput}.${base64url(signature)}`;
};

export const generateRsaKeyPair = (): { privateKey: string; publicKey: string } => {

    const pair = generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    return { privateKey: pair.privateKey, publicKey: pair.publicKey };
};

export const mintAccessToken = (
    privateKey: string,
    overrides: {
        expirationAt?: Date;
        tokenType?: string;
        audience?: string;
        keyId?: string;
        body?: Partial<AccessTokenBody>;
    } = {},
): string => {

    const issuedAt = new Date();
    const expirationAt = overrides.expirationAt
        ?? new Date(issuedAt.getTime() + 3 * 60 * 60 * 1000);

    const header = {
        alg: "RS256",
        kid: overrides.keyId ?? KEY_ID,
        typ: overrides.tokenType ?? "vnd.sudomimus.application-access+jwt",
    };
    const body = overrides.body ?? {
        iss: "https://connect-api.sudomimus.com",
        aud: overrides.audience ?? APPLICATION_ANCHOR,
        sub: "subject-1",
        sid: "session-1",
        jti: "access-1",
        iat: Math.floor(issuedAt.getTime() / 1000),
        exp: Math.floor(expirationAt.getTime() / 1000),
    };
    return mintToken(privateKey, header, body);
};

export const mintRefreshToken = (
    privateKey: string,
    overrides: { tokenType?: string; audience?: string; keyId?: string } = {},
): string => {

    const issuedAt = new Date();
    const expirationAt = new Date(issuedAt.getTime() + 30 * 24 * 60 * 60 * 1000);

    const header = {
        alg: "RS256",
        kid: overrides.keyId ?? KEY_ID,
        typ: overrides.tokenType ?? "vnd.sudomimus.application-refresh+jwt",
    };
    const body: RefreshTokenBody = {
        iss: "https://connect-api.sudomimus.com",
        aud: overrides.audience ?? APPLICATION_ANCHOR,
        sid: "session-1",
        jti: "refresh-1",
        iat: Math.floor(issuedAt.getTime() / 1000),
        exp: Math.floor(expirationAt.getTime() / 1000),
        rotationVersion: 1,
    };
    return mintToken(privateKey, header, body);
};

export const staticResolver = (publicKey: string): PublicKeyResolver => {

    return async () => publicKey;
};
