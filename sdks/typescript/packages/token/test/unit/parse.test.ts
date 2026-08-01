/**
 * @author Sudomimus Contributors
 * @package Token
 * @namespace Parse
 * @description Parse.test
 */

import { parseAccessToken, parseRefreshToken } from "../../src/parse";
import {
    APPLICATION_ANCHOR,
    generateRsaKeyPair,
    mintAccessToken,
    mintRefreshToken,
} from "../helpers/jwt";

describe("parseAccessToken", () => {

    it("returns null for garbage input", () => {

        expect(parseAccessToken("not-a-jwt")).toBeNull();
    });

    it("exposes the typed body", () => {

        const { privateKey } = generateRsaKeyPair();
        const jwt: string = mintAccessToken(privateKey);
        const parsed = parseAccessToken(jwt);

        if (parsed === null) {

            throw new Error("expected a parsed token");
        }

        expect(parsed.body.sub).toBe("subject-1");
        expect(parsed.body.sid).toBe("session-1");
        expect(parsed.body.aud).toBe(APPLICATION_ANCHOR);
        expect(parsed.header.typ).toBe("vnd.sudomimus.application-access+jwt");
    });

    it("rejects an access token carrying profile claims", () => {

        const { privateKey } = generateRsaKeyPair();
        const issuedAt = Math.floor(Date.now() / 1000);
        const jwt: string = mintAccessToken(privateKey, { body: {
            iss: "https://connect-api.sudomimus.com",
            aud: APPLICATION_ANCHOR,
            sub: "subject-1",
            sid: "session-1",
            jti: "access-1",
            iat: issuedAt,
            exp: issuedAt + 3600,
            firstName: "Ada",
        } as Partial<import("../../src").AccessTokenBody> });

        expect(parseAccessToken(jwt)).toBeNull();
    });
});

describe("parseRefreshToken", () => {

    it("returns null for garbage input", () => {

        expect(parseRefreshToken("not-a-jwt")).toBeNull();
    });

    it("exposes rotation state without a subject", () => {

        const { privateKey } = generateRsaKeyPair();
        const parsed = parseRefreshToken(mintRefreshToken(privateKey));
        expect(parsed?.body.sid).toBe("session-1");
        expect(parsed?.body.rotationVersion).toBe(1);
        expect(parsed?.body).not.toHaveProperty("sub");
    });
});
