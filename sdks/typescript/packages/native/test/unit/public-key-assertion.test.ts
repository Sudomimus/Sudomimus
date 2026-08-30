import { createHash } from "node:crypto";
import { signPublicKeyRequest } from "../../src";

const decodeJson = (segment: string): Record<string, unknown> =>
    JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as Record<string, unknown>;

describe("signPublicKeyRequest", () => {

    it("binds the exact body bytes into a fresh strict assertion", async () => {

        let captured = new Uint8Array();
        const signed = await signPublicKeyRequest(
            { applicationAnchor: "anchor-1" },
            {
                keyId: "pky_test",
                sign: (input) => {
                    captured = input;
                    return new Uint8Array(64).fill(7);
                },
            },
            new Date("2026-08-29T12:00:00Z"),
            new Uint8Array(16).fill(3),
        );

        expect(signed.body).toBe('{"applicationAnchor":"anchor-1"}');
        const [headerSegment, claimsSegment, signatureSegment] = signed.authorization
            .replace("SudomimusPublicKeyJWT ", "")
            .split(".");
        expect(decodeJson(headerSegment)).toEqual({
            alg: "EdDSA",
            typ: "vnd.sudomimus.public-key-assertion+jwt",
            kid: "pky_test",
        });
        expect(decodeJson(claimsSegment)).toMatchObject({
            iss: "pky_test",
            aud: "sudomimus-native-public-key",
            iat: 1788004800,
            exp: 1788004860,
            requestHash: createHash("sha256").update(signed.body).digest("base64url"),
        });
        expect(new TextDecoder().decode(captured)).toBe(`${headerSegment}.${claimsSegment}`);
        expect(Buffer.from(signatureSegment, "base64url")).toEqual(Buffer.alloc(64, 7));
    });
});
