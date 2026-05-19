/**
 * @author Sudomimus Contributors
 * @package Connect
 * @namespace Token
 * @description Token.test
 */

import { JWTCreator } from "@sudoo/jwt";
import {
    type AccessTokenBody,
    type AccessTokenHeader,
    type RefreshTokenBody,
    type RefreshTokenHeader,
} from "@sudomimus/token";
import { generateKeyPairSync } from "node:crypto";
import {
    ConnectClient,
    type InfoResponse,
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

const mintAccessToken = (privateKey: string): string => {

    const creator: JWTCreator<AccessTokenHeader, AccessTokenBody> =
        JWTCreator.instantiate(privateKey);
    const issuedAt = new Date();
    const expirationAt = new Date(issuedAt.getTime() + 3 * 60 * 60 * 1000);

    return creator.create({
        issuedAt,
        expirationAt,
        identifier: "access-1",
        keyType: "Access",
        issuer: "sudomimus.com",
        audience: APPLICATION_ANCHOR,
        subject: "refresh-1",
        header: {},
        body: {
            accountIdentifier: "acct-1",
            firstName: "Ada",
            lastName: "Lovelace",
        },
    });
};

const mintRefreshToken = (privateKey: string): string => {

    const creator: JWTCreator<RefreshTokenHeader, RefreshTokenBody> =
        JWTCreator.instantiate(privateKey);
    const issuedAt = new Date();
    const expirationAt = new Date(issuedAt.getTime() + 30 * 24 * 60 * 60 * 1000);

    return creator.create({
        issuedAt,
        expirationAt,
        identifier: "refresh-1",
        keyType: "Refresh",
        issuer: "sudomimus.com",
        audience: APPLICATION_ANCHOR,
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

describe("ConnectClient.verifyAccessToken / verifyRefreshToken", () => {

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

    it("surfaces TokenError from the underlying verifier", async () => {

        const client = new ConnectClient({
            baseUrl: "https://connect.example.com",
            fetch: makeFetch([]) as unknown as typeof globalThis.fetch,
        });

        await expect(client.verifyAccessToken("garbage")).rejects.toMatchObject({
            name: "TokenError",
            code: "INVALID_JWT",
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
