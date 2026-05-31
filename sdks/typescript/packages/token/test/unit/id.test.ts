/**
 * @author Sudomimus Contributors
 * @package Token
 * @namespace Id
 * @description Id.test
 */

import { createSign } from "node:crypto";
import type { IdTokenBody } from "../../src";
import { parseIdToken, verifyIdToken } from "../../src";
import { generateRsaKeyPair } from "../helpers/jwt";

const base64url = (input: Buffer | string): string => {

    return Buffer.from(input)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
};

const mintIdToken = (
    privateKey: string,
    overrides: Partial<IdTokenBody> = {},
): string => {

    const issuedAt = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT", kid: "platform-1" };
    const body: IdTokenBody = {
        iss: "https://oidc.sudomimus.com",
        sub: "subject-1",
        aud: "client-1",
        iat: issuedAt,
        exp: issuedAt + 3600,
        at_hash: "abc",
        email: "ada@example.com",
        email_verified: true,
        name: "Ada Lovelace",
        ...overrides,
    };

    const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(body))}`;
    const signature = base64url(createSign("RSA-SHA256").update(signingInput).sign(privateKey));
    return `${signingInput}.${signature}`;
};

describe("parseIdToken", () => {

    it("returns null for garbage input", () => {

        expect(parseIdToken("not-a-jwt")).toBeNull();
    });

    it("exposes the OIDC body claims", () => {

        const { privateKey } = generateRsaKeyPair();
        const parsed = parseIdToken(mintIdToken(privateKey));

        if (parsed === null) {

            throw new Error("expected a parsed token");
        }

        expect(parsed.body.sub).toBe("subject-1");
        expect(parsed.body.email).toBe("ada@example.com");
        expect(parsed.header.kid).toBe("platform-1");
    });
});

describe("verifyIdToken", () => {

    it("verifies a valid id_token and enforces expectations", () => {

        const { privateKey, publicKey } = generateRsaKeyPair();
        const jwt = mintIdToken(privateKey, { nonce: "n-1" });

        const verified = verifyIdToken(jwt, publicKey, {
            audience: "client-1",
            issuer: "https://oidc.sudomimus.com",
            nonce: "n-1",
        });
        expect(verified.body.sub).toBe("subject-1");
    });

    it("throws EXPIRED when exp is in the past", () => {

        const { privateKey, publicKey } = generateRsaKeyPair();
        const past = Math.floor(Date.now() / 1000) - 10;
        const jwt = mintIdToken(privateKey, { iat: past - 3600, exp: past });

        expect(() => verifyIdToken(jwt, publicKey)).toThrow(/expired/i);
    });

    it("throws INVALID_SIGNATURE when signed by an unrelated key", () => {

        const { privateKey } = generateRsaKeyPair();
        const { publicKey: otherPublicKey } = generateRsaKeyPair();
        const jwt = mintIdToken(privateKey);

        expect(() => verifyIdToken(jwt, otherPublicKey)).toThrow(/signature/i);
    });

    it("throws WRONG_NONCE on a mismatched nonce", () => {

        const { privateKey, publicKey } = generateRsaKeyPair();
        const jwt = mintIdToken(privateKey, { nonce: "n-1" });

        expect(() => verifyIdToken(jwt, publicKey, { nonce: "n-2" })).toThrow(/nonce/i);
    });
});
