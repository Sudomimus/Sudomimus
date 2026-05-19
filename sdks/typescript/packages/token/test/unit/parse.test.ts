/**
 * @author Sudomimus Contributors
 * @package Token
 * @namespace Parse
 * @description Parse.test
 */

import { parseAccessToken, parseRefreshToken } from "../../src/parse";
import { APPLICATION_ANCHOR, generateRsaKeyPair, mintAccessToken } from "../helpers/jwt";

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

        expect(parsed.body.accountIdentifier).toBe("acct-1");
        expect(parsed.body.firstName).toBe("Ada");
        expect(parsed.header.kty).toBe("Access");
        expect(parsed.header.aud).toBe(APPLICATION_ANCHOR);
    });
});

describe("parseRefreshToken", () => {

    it("returns null for garbage input", () => {

        expect(parseRefreshToken("not-a-jwt")).toBeNull();
    });
});
