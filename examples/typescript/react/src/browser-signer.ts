/**
 * Browser-native implementation of the Sudomimus client-auth JWT signer.
 *
 * The @sudomimus/connect SDK supports a BYO (bring-your-own) signer via
 * `clientAuth.signer`. This file implements that signer using the Web
 * Crypto API (SubtleCrypto) so the React example can run entirely in a
 * browser without polyfilling Node's `crypto` module.
 *
 * JWT layout (matches @sudoo/jwt 3.6+ server-side — uniform base64url):
 *   - header segment:    base64url(JSON(header))               — padding stripped
 *   - body segment:      base64url(JSON(claims))               — padding stripped
 *   - signature segment: base64url(RSA-SHA256(header.body))    — padding stripped
 *
 * Claims carried in the BODY (server reads from `parsed.body`):
 *   - iss: applicationAnchor
 *   - aud: "sudomimus-connect"
 *   - iat, exp: UNIX seconds (lifetime ≤ 60s)
 *   - jti: per-request UUID v4 (server enforces single-use replay)
 *   - body_sha256: standard base64 of SHA-256(rawHttpBody) over UTF-8 bytes
 *     (the claim string itself is standard base64 — only the JWT *segment*
 *     wrapper is base64url)
 */

import type { ConnectClientAuthSigner } from "@sudomimus/connect";

const CLIENT_JWT_AUDIENCE = "sudomimus-connect";
const DEFAULT_LIFETIME_SECONDS = 30;

const stripPadding = (b64: string): string => b64.replace(/=+$/, "");

const toBase64Url = (b64: string): string =>
    stripPadding(b64).replace(/\+/g, "-").replace(/\//g, "_");

const fromBase64Url = (b64url: string): string => {
    const standard = b64url.replace(/-/g, "+").replace(/_/g, "/");
    const padLength = (4 - (standard.length % 4)) % 4;
    return standard + "=".repeat(padLength);
};

const base64EncodeBytes = (bytes: Uint8Array): string => {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
};

const encodeJsonSegment = (value: unknown): string =>
    toBase64Url(btoa(JSON.stringify(value)));

// Returns an ArrayBuffer (not Uint8Array) to keep SubtleCrypto's BufferSource
// typing happy across @types/node / lib.dom interactions.
const pemToPkcs8 = (pem: string): ArrayBuffer => {

    const body = pem
        .replace(/-----BEGIN PRIVATE KEY-----/g, "")
        .replace(/-----END PRIVATE KEY-----/g, "")
        .replace(/\s+/g, "");
    const binary = atob(body);
    const buffer = new ArrayBuffer(binary.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
    return buffer;
};

const utf8ToArrayBuffer = (input: string): ArrayBuffer => {

    const bytes = new TextEncoder().encode(input);
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    return buffer;
};

/**
 * Standard base64 of SHA-256(input) over UTF-8 bytes. Matches the server's
 * `crypto.createHash("sha256").update(input, "utf8").digest("base64")` —
 * this is the claim VALUE format, distinct from the JWT segment encoding.
 */
const sha256Base64 = async (input: string): Promise<string> => {

    const hashBuf = await crypto.subtle.digest("SHA-256", utf8ToArrayBuffer(input));
    return base64EncodeBytes(new Uint8Array(hashBuf));
};

export type BrowserSignerOptions = {
    readonly applicationAnchor: string;
    readonly privateKeyPem: string;
    readonly lifetimeSeconds?: number;
};

/**
 * Build a `ConnectClientAuthSigner` that signs the establish JWT with the
 * provided PEM private key using SubtleCrypto.
 */
export const createBrowserSigner = async (
    options: BrowserSignerOptions,
): Promise<ConnectClientAuthSigner> => {

    const pkcs8 = pemToPkcs8(options.privateKeyPem);
    const key = await crypto.subtle.importKey(
        "pkcs8",
        pkcs8,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["sign"],
    );
    const lifetimeSeconds = options.lifetimeSeconds ?? DEFAULT_LIFETIME_SECONDS;

    return async (rawBody: string): Promise<string> => {

        const now = Math.floor(Date.now() / 1000);
        const body_sha256 = await sha256Base64(rawBody);

        const claims = {
            iss: options.applicationAnchor,
            aud: CLIENT_JWT_AUDIENCE,
            iat: now,
            exp: now + lifetimeSeconds,
            jti: crypto.randomUUID(),
            body_sha256,
        };

        const headerSeg = encodeJsonSegment({ alg: "RS256", typ: "JWT" });
        const bodySeg = encodeJsonSegment(claims);
        const sigBuf = await crypto.subtle.sign(
            "RSASSA-PKCS1-v1_5",
            key,
            utf8ToArrayBuffer(`${headerSeg}.${bodySeg}`),
        );
        const sigSeg = toBase64Url(base64EncodeBytes(new Uint8Array(sigBuf)));

        return `${headerSeg}.${bodySeg}.${sigSeg}`;
    };
};

/**
 * Decode the body (payload) of an access token without verifying the
 * signature. The React example uses this purely to read the user fields
 * already returned from /redeem — no token-trust decision is made here.
 *
 * @sudoo/jwt 3.6+ encodes all three JWT segments as base64url (padding
 * stripped). We translate to standard base64 first, re-pad, then atob.
 */
export const decodeAccessTokenBody = <T>(jwt: string): T => {

    const parts = jwt.split(".");
    if (parts.length !== 3) {
        throw new Error("Malformed JWT: expected three dot-separated segments.");
    }
    return JSON.parse(atob(fromBase64Url(parts[1]))) as T;
};
