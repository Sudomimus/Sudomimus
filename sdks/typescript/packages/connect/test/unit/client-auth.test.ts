/**
 * @author Sudomimus Contributors
 * @package Connect
 * @namespace ClientAuth
 * @description Client-auth.test
 */

import { JWTToken } from "@sudoo/jwt";
import { createHash } from "node:crypto";
import {
    CLIENT_JWT_AUDIENCE,
    CLIENT_JWT_MAX_LIFETIME_SECONDS,
    ConnectConfigError,
    buildEstablishClientJwtClaims,
    sha256Base64,
    signEstablishClientJwt,
} from "../../src";
import { APPLICATION_ANCHOR, generateRsaKeyPair } from "../helpers/jwt";

describe("client-auth helpers", () => {

    describe("sha256Base64", () => {

        it("matches the server's standard-base64 SHA-256 over UTF-8 bytes", () => {

            const input = '{"applicationAnchor":"anchor-1"}';
            const expected = createHash("sha256").update(input, "utf8").digest("base64");

            expect(sha256Base64(input)).toBe(expected);
        });

        it("uses standard base64, not base64url", () => {

            // Crafted input that produces '+' or '/' in standard base64 so we
            // would catch an accidental base64url switch.
            const hash = sha256Base64("?");
            expect(hash).not.toMatch(/[-_]/);
        });
    });

    describe("buildEstablishClientJwtClaims", () => {

        it("populates iss, aud, iat, exp, jti, and body_sha256", () => {

            const now = new Date("2026-05-20T00:00:00Z");
            const claims = buildEstablishClientJwtClaims(APPLICATION_ANCHOR, "{}", {
                lifetimeSeconds: 30,
                jtiGenerator: () => "fixed-jti",
                now,
            });

            expect(claims.iss).toBe(APPLICATION_ANCHOR);
            expect(claims.aud).toBe(CLIENT_JWT_AUDIENCE);
            expect(claims.iat).toBe(Math.floor(now.getTime() / 1000));
            expect(claims.exp).toBe(claims.iat + 30);
            expect(claims.jti).toBe("fixed-jti");
            expect(claims.body_sha256).toBe(sha256Base64("{}"));
        });

        it("rejects lifetimeSeconds above the server-enforced maximum", () => {

            expect(() => buildEstablishClientJwtClaims(APPLICATION_ANCHOR, "{}", {
                lifetimeSeconds: CLIENT_JWT_MAX_LIFETIME_SECONDS + 1,
            })).toThrow(ConnectConfigError);
        });

        it("rejects non-positive lifetimeSeconds", () => {

            expect(() => buildEstablishClientJwtClaims(APPLICATION_ANCHOR, "{}", {
                lifetimeSeconds: 0,
            })).toThrow(ConnectConfigError);
        });
    });

    describe("signEstablishClientJwt", () => {

        it("produces a JWT whose body claims and signature both verify", () => {

            const { privateKey, publicKey } = generateRsaKeyPair();
            const rawBody = JSON.stringify({ applicationAnchor: APPLICATION_ANCHOR });
            const jwt = signEstablishClientJwt({
                applicationAnchor: APPLICATION_ANCHOR,
                privateKeyPem: privateKey,
            }, rawBody);

            const parsed = JWTToken.fromTokenOrNull<Record<string, unknown>, {
                iss: string;
                aud: string;
                iat: number;
                exp: number;
                jti: string;
                body_sha256: string;
            }>(jwt);
            expect(parsed).not.toBeNull();
            expect(parsed!.body.iss).toBe(APPLICATION_ANCHOR);
            expect(parsed!.body.aud).toBe(CLIENT_JWT_AUDIENCE);
            expect(parsed!.body.body_sha256).toBe(sha256Base64(rawBody));
            expect(parsed!.body.exp - parsed!.body.iat).toBeGreaterThan(0);
            expect(parsed!.body.exp - parsed!.body.iat).toBeLessThanOrEqual(CLIENT_JWT_MAX_LIFETIME_SECONDS);
            expect(parsed!.verifySignature(publicKey)).toBe(true);
        });

        it("issues a fresh jti on each call (default generator)", () => {

            const { privateKey } = generateRsaKeyPair();
            const a = signEstablishClientJwt({
                applicationAnchor: APPLICATION_ANCHOR,
                privateKeyPem: privateKey,
            }, "{}");
            const b = signEstablishClientJwt({
                applicationAnchor: APPLICATION_ANCHOR,
                privateKeyPem: privateKey,
            }, "{}");

            const parsedA = JWTToken.fromTokenOrNull<Record<string, unknown>, { jti: string }>(a)!;
            const parsedB = JWTToken.fromTokenOrNull<Record<string, unknown>, { jti: string }>(b)!;
            expect(parsedA.body.jti).not.toBe(parsedB.body.jti);
        });

        it("propagates the configured lifetimeSeconds clamp error", () => {

            const { privateKey } = generateRsaKeyPair();
            expect(() => signEstablishClientJwt({
                applicationAnchor: APPLICATION_ANCHOR,
                privateKeyPem: privateKey,
                lifetimeSeconds: CLIENT_JWT_MAX_LIFETIME_SECONDS + 10,
            }, "{}")).toThrow(ConnectConfigError);
        });
    });
});
