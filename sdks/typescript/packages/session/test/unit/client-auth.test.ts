/**
 * @author Sudomimus Contributors
 * @package Session
 * @namespace ClientAuth
 * @description Client-auth.test
 */

import { JWTToken } from "@sudoo/jwt";
import { createHash } from "node:crypto";
import {
    CLIENT_JWT_AUDIENCE,
    CLIENT_JWT_MAX_LIFETIME_SECONDS,
    SessionConfigError,
    buildSessionClientJwtClaims,
    sha256Base64,
    signSessionClientJwt,
} from "../../src";
import { APPLICATION_ANCHOR, generateRsaKeyPair } from "../helpers/jwt";

describe("session client-auth helpers", () => {

    it("hashes raw bodies with standard-base64 SHA-256", () => {

        const input = '{"subject":"subject-1"}';
        expect(sha256Base64(input)).toBe(
            createHash("sha256").update(input, "utf8").digest("base64"),
        );
    });

    it("builds claims with the session audience", () => {

        const now = new Date("2026-05-20T00:00:00Z");
        const claims = buildSessionClientJwtClaims(APPLICATION_ANCHOR, "{}", {
            lifetimeSeconds: 30,
            jtiGenerator: () => "fixed-jti",
            now,
        });

        expect(claims.iss).toBe(APPLICATION_ANCHOR);
        expect(claims.aud).toBe(CLIENT_JWT_AUDIENCE);
        expect(claims.exp).toBe(claims.iat + 30);
        expect(claims.jti).toBe("fixed-jti");
        expect(claims.body_sha256).toBe(sha256Base64("{}"));
    });

    it("rejects invalid lifetimes", () => {

        expect(() => buildSessionClientJwtClaims(APPLICATION_ANCHOR, "{}", {
            lifetimeSeconds: CLIENT_JWT_MAX_LIFETIME_SECONDS + 1,
        })).toThrow(SessionConfigError);
    });

    it("signs a verifiable client-auth JWT", () => {

        const { privateKey, publicKey } = generateRsaKeyPair();
        const rawBody = JSON.stringify({ subject: "subject-1" });
        const jwt = signSessionClientJwt({
            applicationAnchor: APPLICATION_ANCHOR,
            privateKeyPem: privateKey,
        }, rawBody);

        const parsed = JWTToken.fromTokenOrNull<Record<string, unknown>, {
            iss: string;
            aud: string;
            body_sha256: string;
        }>(jwt);
        expect(parsed).not.toBeNull();
        expect(parsed!.body.iss).toBe(APPLICATION_ANCHOR);
        expect(parsed!.body.aud).toBe(CLIENT_JWT_AUDIENCE);
        expect(parsed!.body.body_sha256).toBe(sha256Base64(rawBody));
        expect(parsed!.verifySignature(publicKey)).toBe(true);
    });
});
