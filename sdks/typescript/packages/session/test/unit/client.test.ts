/**
 * @author Sudomimus Contributors
 * @package Session
 * @namespace Client
 * @description Client.test
 */

import { JWTToken } from "@sudoo/jwt";
import {
    CLIENT_JWT_AUDIENCE,
    CLIENT_JWT_AUTH_SCHEME,
    PRODUCTION_BASE_URL,
    SessionApiError,
    SessionClient,
    SessionConfigError,
} from "../../src";
import type {
    HealthResponse,
    IntrospectResponse,
    LogoutResponse,
    RefreshResponse,
    RevokeAllResponse,
} from "../../src";
import { makeFetch } from "../helpers/fetch";
import { APPLICATION_ANCHOR, generateRsaKeyPair } from "../helpers/jwt";

const claims = {
    email: { requirement: "OFF", state: "UNKNOWN" },
    firstName: { requirement: "OPTIONAL", state: "GRANTED" },
    lastName: { requirement: "OFF", state: "UNKNOWN" },
    avatar: { requirement: "OFF", state: "UNKNOWN" },
} as const;

describe("SessionClient", () => {

    it("uses and normalizes the production base URL by default", () => {

        expect(new SessionClient().baseUrl).toBe(PRODUCTION_BASE_URL);
        expect(new SessionClient({ baseUrl: "https://session.example.com/" }).baseUrl)
            .toBe("https://session.example.com");
    });

    it("GETs /health", async () => {

        const expected: HealthResponse = { ready: true, service: "session", version: "1" };
        const fetchMock = makeFetch([{ ok: true, status: 200, body: expected }]);
        const client = new SessionClient({
            baseUrl: "https://session.example.com",
            fetch: fetchMock as unknown as typeof globalThis.fetch,
        });

        await expect(client.health()).resolves.toEqual(expected);
        expect(fetchMock.mock.calls[0][0]).toBe("https://session.example.com/health");
    });

    it("POSTs /refresh", async () => {

        const expected: RefreshResponse = { accessToken: "a2", refreshToken: "r2", claims };
        const fetchMock = makeFetch([{ ok: true, status: 200, body: expected }]);
        const client = new SessionClient({
            baseUrl: "https://session.example.com",
            fetch: fetchMock as unknown as typeof globalThis.fetch,
        });

        await expect(client.refresh({ refreshToken: "r1" })).resolves.toEqual(expected);
        expect(fetchMock.mock.calls[0][0]).toBe("https://session.example.com/refresh");
        expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({ refreshToken: "r1" });
    });

    it("POSTs /introspect without client auth", async () => {

        const expected: IntrospectResponse = {
            status: "active",
            recommendedRecheckSeconds: 30,
        };
        const fetchMock = makeFetch([{ ok: true, status: 200, body: expected }]);
        const client = new SessionClient({
            baseUrl: "https://session.example.com",
            fetch: fetchMock as unknown as typeof globalThis.fetch,
        });

        await expect(client.introspect({ accessToken: "a1" })).resolves.toEqual(expected);
        expect(fetchMock.mock.calls[0][0]).toBe("https://session.example.com/introspect");
        expect((fetchMock.mock.calls[0][1].headers as Record<string, string>)["Authorization"])
            .toBeUndefined();
    });

    it("POSTs /logout", async () => {

        const expected: LogoutResponse = { revoked: true };
        const fetchMock = makeFetch([{ ok: true, status: 200, body: expected }]);
        const client = new SessionClient({
            baseUrl: "https://session.example.com",
            fetch: fetchMock as unknown as typeof globalThis.fetch,
        });

        await expect(client.logout({ refreshToken: "r1" })).resolves.toEqual(expected);
        expect(fetchMock.mock.calls[0][0]).toBe("https://session.example.com/logout");
    });

    it("requires clientAuth for /revoke-all", async () => {

        const client = new SessionClient({
            baseUrl: "https://session.example.com",
            fetch: makeFetch([]) as unknown as typeof globalThis.fetch,
        });

        await expect(client.revokeAll({ subject: "subject-1" }))
            .rejects.toBeInstanceOf(SessionConfigError);
    });

    it("POSTs /revoke-all with a session-audience client-auth JWT", async () => {

        const { privateKey, publicKey } = generateRsaKeyPair();
        const expected: RevokeAllResponse = { revokedCount: 3 };
        const fetchMock = makeFetch([{ ok: true, status: 200, body: expected }]);
        const client = new SessionClient({
            baseUrl: "https://session.example.com",
            fetch: fetchMock as unknown as typeof globalThis.fetch,
            clientAuth: {
                applicationAnchor: APPLICATION_ANCHOR,
                privateKeyPem: privateKey,
            },
        });

        await expect(client.revokeAll({ subject: "subject-1" })).resolves.toEqual(expected);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("https://session.example.com/revoke-all");
        const headers = init.headers as Record<string, string>;
        const jwt = headers["Authorization"].slice(CLIENT_JWT_AUTH_SCHEME.length + 1);
        const parsed = JWTToken.fromTokenOrNull<Record<string, unknown>, {
            iss: string;
            aud: string;
        }>(jwt);
        expect(headers["Authorization"]).toMatch(new RegExp(`^${CLIENT_JWT_AUTH_SCHEME} `));
        expect(parsed).not.toBeNull();
        expect(parsed!.body.iss).toBe(APPLICATION_ANCHOR);
        expect(parsed!.body.aud).toBe(CLIENT_JWT_AUDIENCE);
        expect(parsed!.verifySignature(publicKey)).toBe(true);
    });

    it("throws SessionApiError with parsed reasons", async () => {

        const fetchMock = makeFetch([{ ok: false, status: 401, body: { reason: "RefreshTokenExpired" } }]);
        const client = new SessionClient({
            baseUrl: "https://session.example.com",
            fetch: fetchMock as unknown as typeof globalThis.fetch,
        });

        await expect(client.refresh({ refreshToken: "bad" })).rejects.toMatchObject({
            name: "SessionApiError",
            status: 401,
            reason: "RefreshTokenExpired",
        } satisfies Partial<SessionApiError>);
    });
});
