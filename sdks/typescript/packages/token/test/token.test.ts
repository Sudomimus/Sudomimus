/**
 * @author Sudomimus Contributors
 * @package Token
 * @namespace Root
 * @description Token.test
 */

import { JWTCreator } from "@sudoo/jwt";
import { generateKeyPairSync } from "node:crypto";
import {
    TokenError,
    TokenVerifier,
    parseAccessToken,
    parseRefreshToken,
    type AccessTokenBody,
    type AccessTokenHeader,
    type PublicKeyResolver,
    type RefreshTokenBody,
    type RefreshTokenHeader,
} from "../src";

const generateRsaKeyPair = (): { privateKey: string; publicKey: string } => {

    const pair = generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    return { privateKey: pair.privateKey, publicKey: pair.publicKey };
};

const APPLICATION_ANCHOR = "anchor-1";

const mintAccessToken = (
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
            accountIdentifier: "acct-1",
            firstName: "Ada",
            lastName: "Lovelace",
        },
    });
};

const mintRefreshToken = (
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
        body: { accountIdentifier: "acct-1" },
    });
};

const staticResolver = (publicKey: string): PublicKeyResolver => {

    return async () => publicKey;
};

describe("token parsing", () => {

    it("parseAccessToken returns null for garbage input", () => {

        expect(parseAccessToken("not-a-jwt")).toBeNull();
    });

    it("parseRefreshToken returns null for garbage input", () => {

        expect(parseRefreshToken("not-a-jwt")).toBeNull();
    });

    it("parseAccessToken exposes the typed body", () => {

        const { privateKey } = generateRsaKeyPair();
        const jwt: string = mintAccessToken(privateKey);
        const parsed = parseAccessToken(jwt);

        if (parsed === null) {

            throw new Error("expected a parsed token");
        }

        expect(parsed.body.accountIdentifier).toBe("acct-1");
        expect(parsed.body.firstName).toBe("Ada");
        expect(parsed.header.kty).toBe("Access");
        expect(parsed.header.aud).toBe(APPLICATION_ANCHOR);
    });
});

describe("TokenVerifier", () => {

    it("verifies a valid access token", async () => {

        const { privateKey, publicKey } = generateRsaKeyPair();
        const jwt: string = mintAccessToken(privateKey);
        const verifier = new TokenVerifier({ resolver: staticResolver(publicKey) });

        const result = await verifier.verifyAccessToken(jwt);
        expect(result.body.accountIdentifier).toBe("acct-1");
        expect(result.header.kty).toBe("Access");
    });

    it("verifies a valid refresh token", async () => {

        const { privateKey, publicKey } = generateRsaKeyPair();
        const jwt: string = mintRefreshToken(privateKey);
        const verifier = new TokenVerifier({ resolver: staticResolver(publicKey) });

        const result = await verifier.verifyRefreshToken(jwt);
        expect(result.body.accountIdentifier).toBe("acct-1");
        expect(result.header.kty).toBe("Refresh");
    });

    it("passes the audience to the resolver", async () => {

        const { privateKey, publicKey } = generateRsaKeyPair();
        const jwt: string = mintAccessToken(privateKey, { audience: "other-anchor" });
        const resolver = jest.fn(async () => publicKey);
        const verifier = new TokenVerifier({ resolver });

        await verifier.verifyAccessToken(jwt);
        expect(resolver).toHaveBeenCalledWith("other-anchor");
    });

    it("throws INVALID_JWT on unparseable input", async () => {

        const verifier = new TokenVerifier({ resolver: staticResolver("unused") });

        await expect(verifier.verifyAccessToken("garbage")).rejects.toMatchObject({
            name: "TokenError",
            code: "INVALID_JWT",
        });
    });

    it("throws WRONG_KEY_TYPE when an access token is verified as a refresh token", async () => {

        const { privateKey } = generateRsaKeyPair();
        const accessJwt: string = mintAccessToken(privateKey);
        const verifier = new TokenVerifier({ resolver: staticResolver("unused") });

        await expect(verifier.verifyRefreshToken(accessJwt)).rejects.toMatchObject({
            name: "TokenError",
            code: "WRONG_KEY_TYPE",
        });
    });

    it("throws MISSING_AUDIENCE when aud is absent", async () => {

        const { privateKey } = generateRsaKeyPair();
        const jwt: string = mintAccessToken(privateKey, { audience: "" });
        const verifier = new TokenVerifier({ resolver: staticResolver("unused") });

        await expect(verifier.verifyAccessToken(jwt)).rejects.toMatchObject({
            name: "TokenError",
            code: "MISSING_AUDIENCE",
        });
    });

    it("throws EXPIRED when expiration is in the past", async () => {

        const { privateKey } = generateRsaKeyPair();
        const jwt: string = mintAccessToken(privateKey, {
            expirationAt: new Date(Date.now() - 60_000),
        });
        const verifier = new TokenVerifier({ resolver: staticResolver("unused") });

        await expect(verifier.verifyAccessToken(jwt)).rejects.toMatchObject({
            name: "TokenError",
            code: "EXPIRED",
        });
    });

    it("throws INVALID_SIGNATURE when the resolver returns the wrong key", async () => {

        const minted = generateRsaKeyPair();
        const other = generateRsaKeyPair();
        const jwt: string = mintAccessToken(minted.privateKey);
        const verifier = new TokenVerifier({ resolver: staticResolver(other.publicKey) });

        await expect(verifier.verifyAccessToken(jwt)).rejects.toMatchObject({
            name: "TokenError",
            code: "INVALID_SIGNATURE",
        });
    });
});

describe("TokenError", () => {

    it("carries a stable code", () => {

        const err = new TokenError("EXPIRED", "x");
        expect(err.code).toBe("EXPIRED");
        expect(err.name).toBe("TokenError");
        expect(err).toBeInstanceOf(Error);
    });
});
