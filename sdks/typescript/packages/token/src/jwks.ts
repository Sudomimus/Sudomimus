/**
 * @author Sudomimus Contributors
 * @package Token
 * @namespace Jwks
 * @description RSA JWK conversion helpers
 */

export interface RsaJsonWebKey {
    readonly kty: "RSA";
    readonly n: string;
    readonly e: string;
    readonly kid: string;
    readonly use: "sig";
    readonly alg: "RS256";
}

const concat = (...parts: Uint8Array[]): Uint8Array => {

    const output = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
    let offset = 0;

    for (const part of parts) {

        output.set(part, offset);
        offset += part.length;
    }
    return output;
};

const derLength = (length: number): Uint8Array => {

    if (length < 128) {

        return Uint8Array.of(length);
    }

    const bytes: number[] = [];
    let remaining = length;

    while (remaining > 0) {

        bytes.unshift(remaining & 0xff);
        remaining >>>= 8;
    }
    return Uint8Array.of(0x80 | bytes.length, ...bytes);
};

const der = (tag: number, value: Uint8Array): Uint8Array =>
    concat(Uint8Array.of(tag), derLength(value.length), value);

const base64UrlBytes = (value: string): Uint8Array => {

    const padded = value.replace(/-/g, "+").replace(/_/g, "/")
        .padEnd(Math.ceil(value.length / 4) * 4, "=");
    const decoded = globalThis.atob(padded);
    return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
};

const derInteger = (value: Uint8Array): Uint8Array => {

    const normalized = value[0] !== undefined && (value[0] & 0x80) !== 0
        ? concat(Uint8Array.of(0), value)
        : value;
    return der(0x02, normalized);
};

const toBase64 = (value: Uint8Array): string => {

    let binary = "";

    for (const byte of value) {

        binary += String.fromCharCode(byte);
    }
    return globalThis.btoa(binary);
};

/** Convert a public RSA JWK into an SPKI PEM accepted by the token verifier. */
export const rsaJwkToPem = (jwk: RsaJsonWebKey): string => {

    const rsaPublicKey = der(0x30, concat(
        derInteger(base64UrlBytes(jwk.n)),
        derInteger(base64UrlBytes(jwk.e)),
    ));
    const rsaEncryptionAlgorithm = Uint8Array.of(
        0x30, 0x0d,
        0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01,
        0x05, 0x00,
    );
    const spki = der(0x30, concat(
        rsaEncryptionAlgorithm,
        der(0x03, concat(Uint8Array.of(0), rsaPublicKey)),
    ));
    const base64 = toBase64(spki);
    const lines = base64.match(/.{1,64}/g) ?? [];
    return `-----BEGIN PUBLIC KEY-----\n${lines.join("\n")}\n-----END PUBLIC KEY-----\n`;
};
