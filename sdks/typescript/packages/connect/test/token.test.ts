/**
 * @author Sudomimus Contributors
 * @package Connect
 * @namespace Token
 * @description Token.test
 */

import { JWTCreator } from "@sudoo/jwt";
import { generateKeyPairSync } from "node:crypto";
import {
    ConnectClient,
    ConnectTokenError,
    parseAccessToken,
    parseRefreshToken,
    type AccessTokenBody,
    type AccessTokenHeader,
    type InfoResponse,
    type RefreshTokenBody,
    type RefreshTokenHeader,
} from "../src";

type FakeResponseSpec = {
    ok: boolean;
    status: number;
    body?: unknown;
};

const makeFetch = (specs: FakeResponseSpec[]): jest.Mock => {

    const queue: FakeResponseSpec[] = [...specs];

    return jest.fn(async (): Promise<Response> => {

        const next: FakeResponseSpec | undefined = queue.shift();

        if (typeof next === "undefined") {

            throw new Error("makeFetch: no more responses queued");
        }

        const text: string = typeof next.body === "undefined" ? "" : JSON.stringify(next.body);
        return {
            ok: next.ok,
            status: next.status,
            json: async () => JSON.parse(text),
            text: async () => text,
        } as unknown as Response;
    });
};

const generateRsaKeyPair = (): { privateKey: string; publicKey: string } => {

    const pair = generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    return { privateKey: pair.privateKey, publicKey: pair.publicKey };
};

const APPLICATION_ANCHOR = "anchor-1";

const mintAccessToken = (
    privateKey: string,
    overrides: { expirationAt?: Date; keyType?: string; audience?: string } = {},
): string => {

    const creator: JWTCreator<AccessTokenHeader, AccessTokenBody> =
        JWTCreator.instantiate(privateKey);
    const issuedAt = new Date();
    const expirationAt = overrides.expirationAt
        ?? new Date(issuedAt.getTime() + 3 * 60 * 60 * 1000);

    return creator.create({
        issuedAt,
        expirationAt,
        identifier: "access-1",
        keyType: overrides.keyType ?? "Access",
        issuer: "sudomimus.com",
        audience: overrides.audience ?? APPLICATION_ANCHOR,
        subject: "refresh-1",
        header: {},
        body: {
            accountIdentifier: "acct-1",
            firstName: "Ada",
            lastName: "Lovelace",
        },
    });
};

const mintRefreshToken = (
    privateKey: string,
    overrides: { keyType?: string; audience?: string } = {},
): string => {

    const creator: JWTCreator<RefreshTokenHeader, RefreshTokenBody> =
        JWTCreator.instantiate(privateKey);
    const issuedAt = new Date();
    const expirationAt = new Date(issuedAt.getTime() + 30 * 24 * 60 * 60 * 1000);

    return creator.create({
        issuedAt,
        expirationAt,
        identifier: "refresh-1",
        keyType: overrides.keyType ?? "Refresh",
        issuer: "sudomimus.com",
        audience: overrides.audience ?? APPLICATION_ANCHOR,
        header: {},
        body: { accountIdentifier: "acct-1" },
    });
};

const buildInfoResponse = (publicKey: string): InfoResponse => {

    return {
        applicationAnchor: APPLICATION_ANCHOR,
        applicationName: "Demo",
        applicationPublicKey: publicKey,
    };
};

describe("token parsing", () => {

    it("parseAccessToken returns null for garbage input", () => {

        expect(parseAccessToken("not-a-jwt")).toBeNull();
    });

    it("parseRefreshToken returns null for garbage input", () => {

        expect(parseRefreshToken("not-a-jwt")).toBeNull();
    });

    it("parseAccessToken exposes the typed body", () => {

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

describe("verifyAccessToken / verifyRefreshToken", () => {

    it("verifies a valid access token and caches the public key", async () => {

        const { privateKey, publicKey } = generateRsaKeyPair();
        const jwt: string = mintAccessToken(privateKey);
        const fetchMock = makeFetch([{
            ok: true,
            status: 200,
            body: buildInfoResponse(publicKey),
        }]);
        const client = new ConnectClient({
            baseUrl: "https://connect.example.com",
            fetch: fetchMock as unknown as typeof globalThis.fetch,
        });

        const first = await client.verifyAccessToken(jwt);
        expect(first.body.accountIdentifier).toBe("acct-1");

        const second = await client.verifyAccessToken(mintAccessToken(privateKey));
        expect(second.body.accountIdentifier).toBe("acct-1");

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("verifies a valid refresh token", async () => {

        const { privateKey, publicKey } = generateRsaKeyPair();
        const jwt: string = mintRefreshToken(privateKey);
        const fetchMock = makeFetch([{
            ok: true,
            status: 200,
            body: buildInfoResponse(publicKey),
        }]);
        const client = new ConnectClient({
            baseUrl: "https://connect.example.com",
            fetch: fetchMock as unknown as typeof globalThis.fetch,
        });

        const result = await client.verifyRefreshToken(jwt);
        expect(result.body.accountIdentifier).toBe("acct-1");
        expect(result.header.kty).toBe("Refresh");
    });

    it("throws INVALID_JWT on unparseable input", async () => {

        const client = new ConnectClient({
            baseUrl: "https://connect.example.com",
            fetch: makeFetch([]) as unknown as typeof globalThis.fetch,
        });

        await expect(client.verifyAccessToken("garbage")).rejects.toMatchObject({
            name: "ConnectTokenError",
            code: "INVALID_JWT",
        });
    });

    it("throws WRONG_KEY_TYPE when an access token is verified as a refresh token", async () => {

        const { privateKey } = generateRsaKeyPair();
        const accessJwt: string = mintAccessToken(privateKey);
        const client = new ConnectClient({
            baseUrl: "https://connect.example.com",
            fetch: makeFetch([]) as unknown as typeof globalThis.fetch,
        });

        await expect(client.verifyRefreshToken(accessJwt)).rejects.toMatchObject({
            name: "ConnectTokenError",
            code: "WRONG_KEY_TYPE",
        });
    });

    it("throws MISSING_AUDIENCE when aud is absent", async () => {

        const { privateKey } = generateRsaKeyPair();
        const jwt: string = mintAccessToken(privateKey, { audience: "" });
        const client = new ConnectClient({
            baseUrl: "https://connect.example.com",
            fetch: makeFetch([]) as unknown as typeof globalThis.fetch,
        });

        await expect(client.verifyAccessToken(jwt)).rejects.toMatchObject({
            name: "ConnectTokenError",
            code: "MISSING_AUDIENCE",
        });
    });

    it("throws EXPIRED when expiration is in the past", async () => {

        const { privateKey } = generateRsaKeyPair();
        const jwt: string = mintAccessToken(privateKey, {
            expirationAt: new Date(Date.now() - 60_000),
        });
        const client = new ConnectClient({
            baseUrl: "https://connect.example.com",
            fetch: makeFetch([]) as unknown as typeof globalThis.fetch,
        });

        await expect(client.verifyAccessToken(jwt)).rejects.toMatchObject({
            name: "ConnectTokenError",
            code: "EXPIRED",
        });
    });

    it("throws INVALID_SIGNATURE when the cached public key does not match", async () => {

        const minted = generateRsaKeyPair();
        const other = generateRsaKeyPair();
        const jwt: string = mintAccessToken(minted.privateKey);
        const fetchMock = makeFetch([{
            ok: true,
            status: 200,
            body: buildInfoResponse(other.publicKey),
        }]);
        const client = new ConnectClient({
            baseUrl: "https://connect.example.com",
            fetch: fetchMock as unknown as typeof globalThis.fetch,
        });

        await expect(client.verifyAccessToken(jwt)).rejects.toMatchObject({
            name: "ConnectTokenError",
            code: "INVALID_SIGNATURE",
        });
    });
});

describe("public key cache", () => {

    it("fetches once and caches by applicationAnchor", async () => {

        const { publicKey } = generateRsaKeyPair();
        const fetchMock = makeFetch([
            { ok: true, status: 200, body: buildInfoResponse(publicKey) },
        ]);
        const client = new ConnectClient({
            baseUrl: "https://connect.example.com",
            fetch: fetchMock as unknown as typeof globalThis.fetch,
        });

        const first = await client.getApplicationPublicKey(APPLICATION_ANCHOR);
        const second = await client.getApplicationPublicKey(APPLICATION_ANCHOR);
        expect(first).toBe(publicKey);
        expect(second).toBe(publicKey);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("force refetches when options.force is true", async () => {

        const a = generateRsaKeyPair().publicKey;
        const b = generateRsaKeyPair().publicKey;
        const fetchMock = makeFetch([
            { ok: true, status: 200, body: buildInfoResponse(a) },
            { ok: true, status: 200, body: buildInfoResponse(b) },
        ]);
        const client = new ConnectClient({
            baseUrl: "https://connect.example.com",
            fetch: fetchMock as unknown as typeof globalThis.fetch,
        });

        expect(await client.getApplicationPublicKey(APPLICATION_ANCHOR)).toBe(a);
        expect(await client.getApplicationPublicKey(APPLICATION_ANCHOR, { force: true })).toBe(b);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("clearPublicKeyCache(anchor) evicts only that entry", async () => {

        const a = generateRsaKeyPair().publicKey;
        const aRefetched = generateRsaKeyPair().publicKey;
        const fetchMock = makeFetch([
            { ok: true, status: 200, body: buildInfoResponse(a) },
            { ok: true, status: 200, body: buildInfoResponse(aRefetched) },
        ]);
        const client = new ConnectClient({
            baseUrl: "https://connect.example.com",
            fetch: fetchMock as unknown as typeof globalThis.fetch,
        });

        await client.getApplicationPublicKey(APPLICATION_ANCHOR);
        client.clearPublicKeyCache(APPLICATION_ANCHOR);
        const after = await client.getApplicationPublicKey(APPLICATION_ANCHOR);
        expect(after).toBe(aRefetched);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("uses the configured publicKeyFetchLocale when fetching /info", async () => {

        const { publicKey } = generateRsaKeyPair();
        const fetchMock = makeFetch([{
            ok: true,
            status: 200,
            body: buildInfoResponse(publicKey),
        }]);
        const client = new ConnectClient({
            baseUrl: "https://connect.example.com",
            fetch: fetchMock as unknown as typeof globalThis.fetch,
            publicKeyFetchLocale: "zh-CN",
        });

        await client.getApplicationPublicKey(APPLICATION_ANCHOR);
        const [, init] = fetchMock.mock.calls[0];
        expect(JSON.parse(init.body as string)).toEqual({
            applicationAnchor: APPLICATION_ANCHOR,
            locale: "zh-CN",
        });
    });
});

describe("ConnectTokenError", () => {

    it("carries a stable code", () => {

        const err = new ConnectTokenError("EXPIRED", "x");
        expect(err.code).toBe("EXPIRED");
        expect(err.name).toBe("ConnectTokenError");
        expect(err).toBeInstanceOf(Error);
    });
});
