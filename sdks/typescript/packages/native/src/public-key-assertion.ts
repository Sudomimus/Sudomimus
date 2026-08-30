/** Helpers for the Native public-key direct-issue assertion. */

import type { DirectIssuePublicKeyRequest, PublicKeyCredential } from "./declare.js";

export const PUBLIC_KEY_ASSERTION_AUDIENCE = "sudomimus-native-public-key";
export const PUBLIC_KEY_ASSERTION_TYPE = "vnd.sudomimus.public-key-assertion+jwt";
export const PUBLIC_KEY_AUTHORIZATION_SCHEME = "SudomimusPublicKeyJWT";

const encoder = new TextEncoder();

const base64Url = (value: Uint8Array): string => {

    const base64 = globalThis.btoa(String.fromCharCode(...value));
    return base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
};

export type SignedPublicKeyRequest = {
    /** Exact UTF-8 request body covered by `requestHash`. */
    body: string;
    /** Complete Authorization header value. */
    authorization: string;
};

/**
 * Serialize a public-key request once, bind its exact bytes into a compact
 * EdDSA assertion, and return both values so callers cannot accidentally send
 * bytes different from those that were signed.
 */
export const signPublicKeyRequest = async (
    request: DirectIssuePublicKeyRequest,
    credential: PublicKeyCredential,
    now: Date = new Date(),
    jtiBytes?: Uint8Array,
): Promise<SignedPublicKeyRequest> => {

    const body = JSON.stringify(request);
    const bodyBytes = encoder.encode(body);
    const requestDigest = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bodyBytes));
    const nonce = jtiBytes ?? globalThis.crypto.getRandomValues(new Uint8Array(16));

    if (nonce.byteLength !== 16) {

        throw new TypeError("jtiBytes must contain exactly 16 random bytes.");
    }

    const issuedAt = Math.floor(now.getTime() / 1000);
    const header = {
        alg: "EdDSA",
        typ: PUBLIC_KEY_ASSERTION_TYPE,
        kid: credential.keyId,
    } as const;
    const claims = {
        iss: credential.keyId,
        aud: PUBLIC_KEY_ASSERTION_AUDIENCE,
        iat: issuedAt,
        exp: issuedAt + 60,
        jti: base64Url(nonce),
        requestHash: base64Url(requestDigest),
    } as const;
    const headerSegment = base64Url(encoder.encode(JSON.stringify(header)));
    const claimsSegment = base64Url(encoder.encode(JSON.stringify(claims)));
    const signingInput = encoder.encode(`${headerSegment}.${claimsSegment}`);
    const signature = await credential.sign(signingInput);

    if (signature.byteLength !== 64) {

        throw new TypeError("Ed25519 signatures must contain exactly 64 bytes.");
    }

    const assertion = `${headerSegment}.${claimsSegment}.${base64Url(signature)}`;
    return {
        body,
        authorization: `${PUBLIC_KEY_AUTHORIZATION_SCHEME} ${assertion}`,
    };
};
