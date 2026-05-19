/**
 * @author Sudomimus Contributors
 * @package Connect
 * @namespace Test_Helpers
 * @description Shared JWT test helpers
 */

import { JWTCreator } from "@sudoo/jwt";
import {
    type AccessTokenBody,
    type AccessTokenHeader,
    type RefreshTokenBody,
    type RefreshTokenHeader,
} from "@sudomimus/token";
import { generateKeyPairSync } from "node:crypto";

export const APPLICATION_ANCHOR = "anchor-1";

export const generateRsaKeyPair = (): { privateKey: string; publicKey: string } => {

    const pair = generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    return { privateKey: pair.privateKey, publicKey: pair.publicKey };
};

export const mintAccessToken = (privateKey: string): string => {

    const creator: JWTCreator<AccessTokenHeader, AccessTokenBody> =
        JWTCreator.instantiate(privateKey);
    const issuedAt = new Date();
    const expirationAt = new Date(issuedAt.getTime() + 3 * 60 * 60 * 1000);

    return creator.create({
        issuedAt,
        expirationAt,
        identifier: "access-1",
        keyType: "Access",
        issuer: "sudomimus.com",
        audience: APPLICATION_ANCHOR,
        subject: "refresh-1",
        header: {},
        body: {
            accountIdentifier: "acct-1",
            firstName: "Ada",
            lastName: "Lovelace",
        },
    });
};

export const mintRefreshToken = (privateKey: string): string => {

    const creator: JWTCreator<RefreshTokenHeader, RefreshTokenBody> =
        JWTCreator.instantiate(privateKey);
    const issuedAt = new Date();
    const expirationAt = new Date(issuedAt.getTime() + 30 * 24 * 60 * 60 * 1000);

    return creator.create({
        issuedAt,
        expirationAt,
        identifier: "refresh-1",
        keyType: "Refresh",
        issuer: "sudomimus.com",
        audience: APPLICATION_ANCHOR,
        header: {},
        body: { accountIdentifier: "acct-1" },
    });
};
