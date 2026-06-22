/**
 * @author Sudomimus Contributors
 * @package Connect
 * @namespace Client
 * @description Client.test
 */

import { JWTToken } from "@sudoo/jwt";
import { createHash } from "node:crypto";
import {
    CLIENT_JWT_AUDIENCE,
    CLIENT_JWT_AUTH_SCHEME,
    ConnectApiError,
    ConnectClient,
    ConnectConfigError,
    RETURN_METHOD,
} from "../../src";
import type {
    EstablishResponse,
    HealthResponse,
    InfoResponse,
    RedeemResponse,
    StatusPollResponse,
} from "../../src";
import { buildInfoResponse, makeFetch } from "../helpers/fetch";
import {
    APPLICATION_ANCHOR,
    generateRsaKeyPair,
    mintAccessToken,
    mintRefreshToken,
} from "../helpers/jwt";

const sha256Base64 = (input: string): string =>
    createHash("sha256").update(input, "utf8").digest("base64");

const claims = {
    email: { requirement: "OFF", state: "UNKNOWN" },
    firstName: { requirement: "OPTIONAL", state: "GRANTED" },
    lastName: { requirement: "OFF", state: "UNKNOWN" },
} as const;

describe("ConnectClient", () => {

    it("normalizes the base URL", () => {

        const client = new ConnectClient({
            baseUrl: "https://connect.example.com/",
        });

        expect(client.baseUrl).toBe("https://connect.example.com");
    });

    describe("health", () => {

        it("GETs /health and returns the parsed body", async () => {

            const expected: HealthResponse = {
                ready: true,
                service: "connect",
                version: "1.2.3",
            };
            const fetchMock = makeFetch([{ ok: true, status: 200, body: expected }]);
            const client = new ConnectClient({
                baseUrl: "https://connect.example.com",
                fetch: fetchMock as unknown as typeof globalThis.fetch,
            });

            const result = await client.health();

            expect(result).toEqual(expected);
            expect(fetchMock).toHaveBeenCalledTimes(1);
            const [url, init] = fetchMock.mock.calls[0];
            expect(url).toBe("https://connect.example.com/health");
            expect(init.method).toBe("GET");
            expect(init.headers).toEqual({ "Accept": "application/json" });
            expect(init.body).toBeUndefined();
        });
    });

    describe("establish", () => {

        it("throws ConnectConfigError when clientAuth is not configured", async () => {

            const client = new ConnectClient({
                baseUrl: "https://connect.example.com",
                fetch: makeFetch([]) as unknown as typeof globalThis.fetch,
            });

            await expect(client.establish({
                applicationAnchor: APPLICATION_ANCHOR,
            })).rejects.toBeInstanceOf(ConnectConfigError);
        });

        it("POSTs /establish with a signed client-auth JWT and the JSON body", async () => {

            const { privateKey, publicKey } = generateRsaKeyPair();
            const expected: EstablishResponse = {
                applicationAnchor: APPLICATION_ANCHOR,
                exposureKey: "exp",
                hiddenKey: "hid",
            };
            const fetchMock = makeFetch([{ ok: true, status: 200, body: expected }]);
            const client = new ConnectClient({
                baseUrl: "https://connect.example.com",
                fetch: fetchMock as unknown as typeof globalThis.fetch,
                clientAuth: {
                    applicationAnchor: APPLICATION_ANCHOR,
                    privateKeyPem: privateKey,
                },
            });

            const result = await client.establish({
                applicationAnchor: APPLICATION_ANCHOR,
                returnMethods: [{ type: RETURN_METHOD.STATUS_POLL, payload: {} }],
            });

            expect(result).toEqual(expected);
            const [url, init] = fetchMock.mock.calls[0];
            expect(url).toBe("https://connect.example.com/establish");
            expect(init.method).toBe("POST");

            const headers = init.headers as Record<string, string>;
            expect(headers["Content-Type"]).toBe("application/json");
            expect(headers["Accept"]).toBe("application/json");
            expect(headers["Authorization"]).toMatch(new RegExp(`^${CLIENT_JWT_AUTH_SCHEME} `));

            const sentBody = init.body as string;
            expect(JSON.parse(sentBody)).toEqual({
                applicationAnchor: APPLICATION_ANCHOR,
                returnMethods: [{ type: "STATUS_POLL", payload: {} }],
            });

            // Body hash from the wire must match the JWT's body_sha256 — that
            // is the entire point of the binding. If serialization happens
            // twice the hashes drift and the server rejects with 401.
            const jwt = headers["Authorization"].slice(CLIENT_JWT_AUTH_SCHEME.length + 1);
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
            expect(parsed!.body.exp - parsed!.body.iat).toBeLessThanOrEqual(60);
            expect(parsed!.body.body_sha256).toBe(sha256Base64(sentBody));
            expect(parsed!.verifySignature(publicKey)).toBe(true);
        });

        it("delegates to a BYO signer when one is configured", async () => {

            const expected: EstablishResponse = {
                applicationAnchor: APPLICATION_ANCHOR,
                exposureKey: "exp",
                hiddenKey: "hid",
            };
            const fetchMock = makeFetch([{ ok: true, status: 200, body: expected }]);
            const signer = jest.fn(async (_rawBody: string) => "byo.jwt.token");
            const client = new ConnectClient({
                baseUrl: "https://connect.example.com",
                fetch: fetchMock as unknown as typeof globalThis.fetch,
                clientAuth: {
                    applicationAnchor: APPLICATION_ANCHOR,
                    signer,
                },
            });

            await client.establish({ applicationAnchor: APPLICATION_ANCHOR });

            expect(signer).toHaveBeenCalledTimes(1);
            const [rawBody] = signer.mock.calls[0];
            expect(JSON.parse(rawBody)).toEqual({ applicationAnchor: APPLICATION_ANCHOR });

            const [, init] = fetchMock.mock.calls[0];
            expect((init.headers as Record<string, string>)["Authorization"]).toBe(
                `${CLIENT_JWT_AUTH_SCHEME} byo.jwt.token`,
            );
            // The body fed to the signer is the exact bytes shipped to the server.
            expect(init.body).toBe(rawBody);
        });
    });

    describe("statusPoll", () => {

        it("returns a PENDING response", async () => {

            const expected: StatusPollResponse = { status: "PENDING" };
            const fetchMock = makeFetch([{ ok: true, status: 200, body: expected }]);
            const client = new ConnectClient({
                baseUrl: "https://connect.example.com",
                fetch: fetchMock as unknown as typeof globalThis.fetch,
            });

            const result = await client.statusPoll({ exposureKey: "exp", hiddenKey: "hid" });

            expect(result.status).toBe("PENDING");

            if (result.status === "REALIZED") {

                throw new Error("expected PENDING, got REALIZED");
            }
        });

        it("returns a REALIZED response with a confirmationKey", async () => {

            const expected: StatusPollResponse = {
                status: "REALIZED",
                confirmationKey: "conf-1",
            };
            const fetchMock = makeFetch([{ ok: true, status: 200, body: expected }]);
            const client = new ConnectClient({
                baseUrl: "https://connect.example.com",
                fetch: fetchMock as unknown as typeof globalThis.fetch,
            });

            const result = await client.statusPoll({ exposureKey: "exp", hiddenKey: "hid" });

            expect(result.status).toBe("REALIZED");

            if (result.status === "REALIZED") {

                expect(result.confirmationKey).toBe("conf-1");
            }
        });
    });

    describe("redeem", () => {

        it("returns the application token pair", async () => {

            const expected: RedeemResponse = {
                applicationAnchor: "anchor-1",
                refreshToken: "r-jwt",
                accessToken: "a-jwt",
                claims,
            };
            const fetchMock = makeFetch([{ ok: true, status: 200, body: expected }]);
            const client = new ConnectClient({
                baseUrl: "https://connect.example.com",
                fetch: fetchMock as unknown as typeof globalThis.fetch,
            });

            const result = await client.redeem({
                exposureKey: "exp",
                hiddenKey: "hid",
                confirmationKey: "conf",
            });

            expect(result).toEqual(expected);
            expect(fetchMock.mock.calls[0][0]).toBe("https://connect.example.com/redeem");
        });
    });

    describe("info", () => {

        it("returns localized application metadata", async () => {

            const expected: InfoResponse = {
                applicationAnchor: "anchor-1",
                applicationName: "Demo App",
                applicationPublicKey: "-----BEGIN PUBLIC KEY-----",
            };
            const fetchMock = makeFetch([{ ok: true, status: 200, body: expected }]);
            const client = new ConnectClient({
                baseUrl: "https://connect.example.com",
                fetch: fetchMock as unknown as typeof globalThis.fetch,
            });

            const result = await client.info({ applicationAnchor: "anchor-1", locale: "en-US" });

            expect(result).toEqual(expected);
            expect(fetchMock.mock.calls[0][0]).toBe("https://connect.example.com/info");
        });
    });

    describe("error handling", () => {

        it("throws ConnectApiError with the parsed reason on a JSON error body", async () => {

            const { privateKey } = generateRsaKeyPair();
            const fetchMock = makeFetch([{
                ok: false,
                status: 400,
                body: { reason: "ApplicationNotFound" },
            }]);
            const client = new ConnectClient({
                baseUrl: "https://connect.example.com",
                fetch: fetchMock as unknown as typeof globalThis.fetch,
                clientAuth: {
                    applicationAnchor: "missing",
                    privateKeyPem: privateKey,
                },
            });

            await expect(client.establish({
                applicationAnchor: "missing",
            })).rejects.toMatchObject({
                name: "ConnectApiError",
                status: 400,
                reason: "ApplicationNotFound",
            });
        });

        it("throws ConnectApiError with undefined reason on an empty error body", async () => {

            const fetchMock = makeFetch([{ ok: false, status: 401, rawBody: "" }]);
            const client = new ConnectClient({
                baseUrl: "https://connect.example.com",
                fetch: fetchMock as unknown as typeof globalThis.fetch,
            });

            let caught: unknown;

            try {

                await client.health();
            } catch (err) {

                caught = err;
            }

            expect(caught).toBeInstanceOf(ConnectApiError);
            const apiError = caught as ConnectApiError;
            expect(apiError.status).toBe(401);
            expect(apiError.reason).toBeUndefined();
            expect(apiError.body).toBeUndefined();
        });

        it("throws ConnectApiError with undefined reason on a non-JSON error body", async () => {

            const fetchMock = makeFetch([{
                ok: false,
                status: 500,
                rawBody: "<html>upstream error</html>",
            }]);
            const client = new ConnectClient({
                baseUrl: "https://connect.example.com",
                fetch: fetchMock as unknown as typeof globalThis.fetch,
            });

            await expect(client.health()).rejects.toMatchObject({
                name: "ConnectApiError",
                status: 500,
                reason: undefined,
            });
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
            expect(first.body.subject).toBe("subject-1");

            const second = await client.verifyAccessToken(mintAccessToken(privateKey));
            expect(second.body.subject).toBe("subject-1");

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
            expect(result.body.subject).toBe("subject-1");
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
});
