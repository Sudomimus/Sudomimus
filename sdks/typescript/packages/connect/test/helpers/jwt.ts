/**
 * @author Sudomimus Contributors
 * @package Connect
 * @namespace Test_Helpers
 * @description Shared JWT test helpers
 */

import { createSign, generateKeyPairSync } from "node:crypto";

export const APPLICATION_ANCHOR = "anchor-1";
export const KEY_ID = "key-1";

const mintToken = (
    privateKey: string,
    header: Record<string, unknown>,
    body: Record<string, unknown>,
): string => {

    const headerSegment = Buffer.from(JSON.stringify(header)).toString("base64url");
    const bodySegment = Buffer.from(JSON.stringify(body)).toString("base64url");
    const signingInput = `${headerSegment}.${bodySegment}`;
    const signature = createSign("RSA-SHA256").update(signingInput).sign(privateKey);
    return `${signingInput}.${signature.toString("base64url")}`;
};

export const generateRsaKeyPair = (): { privateKey: string; publicKey: string } => {

    const pair = generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    return { privateKey: pair.privateKey, publicKey: pair.publicKey };
};

export const mintAccessToken = (privateKey: string): string => {

    const issuedAt = new Date();
    const expirationAt = new Date(issuedAt.getTime() + 3 * 60 * 60 * 1000);

    return mintToken(privateKey, {
        alg: "RS256", kid: KEY_ID, typ: "vnd.sudomimus.application-access+jwt",
    }, {
        iss: "https://connect-api.sudomimus.com",
        aud: APPLICATION_ANCHOR,
        sub: "subject-1",
        sid: "session-1",
        jti: "access-1",
        iat: Math.floor(issuedAt.getTime() / 1000),
        exp: Math.floor(expirationAt.getTime() / 1000),
    });
};

export const mintRefreshToken = (privateKey: string): string => {

    const issuedAt = new Date();
    const expirationAt = new Date(issuedAt.getTime() + 30 * 24 * 60 * 60 * 1000);

    return mintToken(privateKey, {
        alg: "RS256", kid: KEY_ID, typ: "vnd.sudomimus.application-refresh+jwt",
    }, {
        iss: "https://connect-api.sudomimus.com",
        aud: APPLICATION_ANCHOR,
        sid: "session-1",
        jti: "refresh-1",
        iat: Math.floor(issuedAt.getTime() / 1000),
        exp: Math.floor(expirationAt.getTime() / 1000),
        rotationVersion: 1,
    });
};
