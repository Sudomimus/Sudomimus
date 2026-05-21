/**
 * @author Sudomimus Contributors
 * @package Native
 * @namespace Client
 * @description Client.test
 */

import { NativeApiError, NativeClient } from "../../src";
import type { DirectIssueAccessKeyResponse, DirectIssueSteamTicketResponse } from "../../src";

const VALID_ACCESS_KEY_IDENTIFIER = "01890c5e-1234-4abc-9def-0123456789ab";
const VALID_ACCESS_KEY_SECRET = "a".repeat(64);

type FakeResponseSpec = {
    ok: boolean;
    status: number;
    body?: unknown;
    rawBody?: string;
};

const makeFetch = (specs: FakeResponseSpec[]): jest.Mock => {

    const queue: FakeResponseSpec[] = [...specs];

    return jest.fn(async (): Promise<Response> => {

        const next: FakeResponseSpec | undefined = queue.shift();

        if (typeof next === "undefined") {

            throw new Error("makeFetch: no more responses queued");
        }

        const text: string = typeof next.rawBody === "string"
            ? next.rawBody
            : typeof next.body === "undefined"
                ? ""
                : JSON.stringify(next.body);

        return {
            ok: next.ok,
            status: next.status,
            json: async () => JSON.parse(text),
            text: async () => text,
        } as unknown as Response;
    });
};

describe("NativeClient", () => {

    it("normalizes the base URL", () => {

        const client = new NativeClient({
            baseUrl: "https://native.example.com/",
        });

        expect(client.baseUrl).toBe("https://native.example.com");
    });

    describe("directIssueSteamTicket", () => {

        it("POSTs /direct-issue/steam-ticket with the JSON body and returns the response", async () => {

            const expected: DirectIssueSteamTicketResponse = {
                applicationAnchor: "anchor-1",
                accessToken: "a-jwt",
                refreshToken: "r-jwt",
            };
            const fetchMock = makeFetch([{ ok: true, status: 200, body: expected }]);
            const client = new NativeClient({
                baseUrl: "https://native.example.com",
                fetch: fetchMock as unknown as typeof globalThis.fetch,
            });

            const result = await client.directIssueSteamTicket({
                applicationAnchor: "anchor-1",
                steamTicketHex: "deadbeef",
                steamAppId: 480,
            });

            expect(result).toEqual(expected);
            const [url, init] = fetchMock.mock.calls[0];
            expect(url).toBe("https://native.example.com/direct-issue/steam-ticket");
            expect(init.method).toBe("POST");
            expect(init.headers).toEqual({
                "Content-Type": "application/json",
                "Accept": "application/json",
            });
            expect(JSON.parse(init.body as string)).toEqual({
                applicationAnchor: "anchor-1",
                steamTicketHex: "deadbeef",
                steamAppId: 480,
            });
        });
    });

    describe("directIssueAccessKey", () => {

        it("POSTs /direct-issue/access-key with the JSON body and returns the response", async () => {

            const expected: DirectIssueAccessKeyResponse = {
                applicationAnchor: "anchor-1",
                accessToken: "a-jwt",
                refreshToken: "r-jwt",
            };
            const fetchMock = makeFetch([{ ok: true, status: 200, body: expected }]);
            const client = new NativeClient({
                baseUrl: "https://native.example.com",
                fetch: fetchMock as unknown as typeof globalThis.fetch,
            });

            const result = await client.directIssueAccessKey({
                applicationAnchor: "anchor-1",
                accessKeyIdentifier: VALID_ACCESS_KEY_IDENTIFIER,
                accessKeySecret: VALID_ACCESS_KEY_SECRET,
            });

            expect(result).toEqual(expected);
            const [url, init] = fetchMock.mock.calls[0];
            expect(url).toBe("https://native.example.com/direct-issue/access-key");
            expect(init.method).toBe("POST");
            expect(init.headers).toEqual({
                "Content-Type": "application/json",
                "Accept": "application/json",
            });
            expect(JSON.parse(init.body as string)).toEqual({
                applicationAnchor: "anchor-1",
                accessKeyIdentifier: VALID_ACCESS_KEY_IDENTIFIER,
                accessKeySecret: VALID_ACCESS_KEY_SECRET,
            });
        });

        it("surfaces opaque 401 AccessKeyDirectDenied on any credential failure", async () => {

            const fetchMock = makeFetch([{
                ok: false,
                status: 401,
                body: { reason: "AccessKeyDirectDenied" },
            }]);
            const client = new NativeClient({
                baseUrl: "https://native.example.com",
                fetch: fetchMock as unknown as typeof globalThis.fetch,
            });

            await expect(client.directIssueAccessKey({
                applicationAnchor: "anchor-1",
                accessKeyIdentifier: VALID_ACCESS_KEY_IDENTIFIER,
                accessKeySecret: VALID_ACCESS_KEY_SECRET,
            })).rejects.toMatchObject({
                name: "NativeApiError",
                status: 401,
                reason: "AccessKeyDirectDenied",
            });
        });

        it("surfaces 403 layer rejections", async () => {

            const fetchMock = makeFetch([{
                ok: false,
                status: 403,
                body: { reason: "Layer1Denied" },
            }]);
            const client = new NativeClient({
                baseUrl: "https://native.example.com",
                fetch: fetchMock as unknown as typeof globalThis.fetch,
            });

            await expect(client.directIssueAccessKey({
                applicationAnchor: "anchor-1",
                accessKeyIdentifier: VALID_ACCESS_KEY_IDENTIFIER,
                accessKeySecret: VALID_ACCESS_KEY_SECRET,
            })).rejects.toMatchObject({
                name: "NativeApiError",
                status: 403,
                reason: "Layer1Denied",
            });
        });
    });

    describe("error handling", () => {

        it("throws NativeApiError with parsed reason on a JSON error body", async () => {

            const fetchMock = makeFetch([{
                ok: false,
                status: 403,
                body: { reason: "Layer1Denied" },
            }]);
            const client = new NativeClient({
                baseUrl: "https://native.example.com",
                fetch: fetchMock as unknown as typeof globalThis.fetch,
            });

            await expect(client.directIssueSteamTicket({
                applicationAnchor: "anchor-1",
                steamTicketHex: "deadbeef",
                steamAppId: 480,
            })).rejects.toMatchObject({
                name: "NativeApiError",
                status: 403,
                reason: "Layer1Denied",
            });
        });

        it("surfaces 409 replay-protection conflicts", async () => {

            const fetchMock = makeFetch([{
                ok: false,
                status: 409,
                body: { reason: "ReplayProtectionAlreadySeen" },
            }]);
            const client = new NativeClient({
                baseUrl: "https://native.example.com",
                fetch: fetchMock as unknown as typeof globalThis.fetch,
            });

            await expect(client.directIssueSteamTicket({
                applicationAnchor: "anchor-1",
                steamTicketHex: "deadbeef",
                steamAppId: 480,
            })).rejects.toMatchObject({
                name: "NativeApiError",
                status: 409,
                reason: "ReplayProtectionAlreadySeen",
            });
        });

        it("throws NativeApiError with undefined reason on an empty error body", async () => {

            const fetchMock = makeFetch([{ ok: false, status: 401, rawBody: "" }]);
            const client = new NativeClient({
                baseUrl: "https://native.example.com",
                fetch: fetchMock as unknown as typeof globalThis.fetch,
            });

            let caught: unknown;

            try {

                await client.directIssueSteamTicket({
                    applicationAnchor: "anchor-1",
                    steamTicketHex: "deadbeef",
                    steamAppId: 480,
                });
            } catch (err) {

                caught = err;
            }

            expect(caught).toBeInstanceOf(NativeApiError);
            const apiError = caught as NativeApiError;
            expect(apiError.status).toBe(401);
            expect(apiError.reason).toBeUndefined();
            expect(apiError.body).toBeUndefined();
        });
    });
});
