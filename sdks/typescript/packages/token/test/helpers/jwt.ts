/**
 * @author Sudomimus Contributors
 * @package Token
 * @namespace Test_Helpers
 * @description Shared JWT test helpers
 */

import { JWTCreator } from "@sudoo/jwt";
import { generateKeyPairSync } from "node:crypto";
import type {
    AccessTokenBody,
    AccessTokenHeader,
    PublicKeyResolver,
    RefreshTokenBody,
    RefreshTokenHeader,
} from "../../src";

export const APPLICATION_ANCHOR = "anchor-1";

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
    overrides: { expirationAt?: Date; keyType?: string; audience?: string } = {},
): string => {

    const creator: JWTCreator<AccessTokenHeader, AccessTokenBody> =
        JWTCreator.instantiate(privateKey);
    const issuedAt = new Date();
    const expirationAt = overrides.expirationAt
        ?? new Date(issuedAt.getTime() + 3 * 60 * 60 * 1000);

    return creator.create({
        issuedAt,
        expirationAt,
        identifier: "access-1",
        keyType: overrides.keyType ?? "Access",
        issuer: "sudomimus.com",
        audience: overrides.audience ?? APPLICATION_ANCHOR,
        subject: "refresh-1",
        header: {},
        body: {
            subject: "subject-1",
            firstName: "Ada",
            lastName: "Lovelace",
            emailAddress: "ada@example.com",
        },
    });
};

export const mintRefreshToken = (
    privateKey: string,
    overrides: { keyType?: string; audience?: string } = {},
): string => {

    const creator: JWTCreator<RefreshTokenHeader, RefreshTokenBody> =
        JWTCreator.instantiate(privateKey);
    const issuedAt = new Date();
    const expirationAt = new Date(issuedAt.getTime() + 30 * 24 * 60 * 60 * 1000);

    return creator.create({
        issuedAt,
        expirationAt,
        identifier: "refresh-1",
        keyType: overrides.keyType ?? "Refresh",
        issuer: "sudomimus.com",
        audience: overrides.audience ?? APPLICATION_ANCHOR,
        header: {},
        body: { subject: "subject-1" },
    });
};

export const staticResolver = (publicKey: string): PublicKeyResolver => {

    return async () => publicKey;
};
