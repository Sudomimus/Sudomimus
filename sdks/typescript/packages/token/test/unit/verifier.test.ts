/**
 * @author Sudomimus Contributors
 * @package Token
 * @namespace Verifier
 * @description Verifier.test
 */

import { TokenVerifier } from "../../src/verifier";
import {
    generateRsaKeyPair,
    mintAccessToken,
    mintRefreshToken,
    staticResolver,
} from "../helpers/jwt";

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
