/**
 * @author Sudomimus Contributors
 * @package Connect
 * @namespace Root
 * @description Index.test
 */

import {
    ConnectApiError,
    ConnectClient,
    type EstablishRequest,
    type EstablishResponse,
    type HealthResponse,
    type InfoResponse,
    type RedeemResponse,
    type RefreshResponse,
    type StatusPollResponse,
} from "../src";

type FakeResponseSpec = {
    ok: boolean;
    status: number;
    body?: unknown;
    rawBody?: string;
};

const makeFetch = (specs: FakeResponseSpec[]): jest.Mock => {

    const calls: FakeResponseSpec[] = [...specs];

    return jest.fn(async (): Promise<Response> => {

        const next: FakeResponseSpec | undefined = calls.shift();

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

describe("ConnectClient", () => {

    it("normalizes the base URL", () => {

        const client = new ConnectClient({
            baseUrl: "https://connect.example.com/",
        });

        expect(client.baseUrl).toBe("https://connect.example.com");
    });

    it("exposes generated request types", () => {

        const request: EstablishRequest = {
            applicationAnchor: "anchor-1",
            actions: [
                {
                    type: "CALLBACK",
                    payload: { callbackUrl: "https://example.com/cb" },
                },
            ],
        };

        expect(request.applicationAnchor).toBe("anchor-1");
        expect(request.actions[0].type).toBe("CALLBACK");
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

        it("POSTs /establish with the JSON body and returns the response", async () => {

            const expected: EstablishResponse = {
                applicationAnchor: "anchor-1",
                exposureKey: "exp",
                hiddenKey: "hid",
            };
            const fetchMock = makeFetch([{ ok: true, status: 200, body: expected }]);
            const client = new ConnectClient({
                baseUrl: "https://connect.example.com",
                fetch: fetchMock as unknown as typeof globalThis.fetch,
            });

            const result = await client.establish({
                applicationAnchor: "anchor-1",
                actions: [{ type: "STATUS_POLL", payload: {} }],
            });

            expect(result).toEqual(expected);
            const [url, init] = fetchMock.mock.calls[0];
            expect(url).toBe("https://connect.example.com/establish");
            expect(init.method).toBe("POST");
            expect(init.headers).toEqual({
                "Content-Type": "application/json",
                "Accept": "application/json",
            });
            expect(JSON.parse(init.body as string)).toEqual({
                applicationAnchor: "anchor-1",
                actions: [{ type: "STATUS_POLL", payload: {} }],
            });
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

    describe("refresh", () => {

        it("returns an access token only", async () => {

            const expected: RefreshResponse = { accessToken: "a-jwt-2" };
            const fetchMock = makeFetch([{ ok: true, status: 200, body: expected }]);
            const client = new ConnectClient({
                baseUrl: "https://connect.example.com",
                fetch: fetchMock as unknown as typeof globalThis.fetch,
            });

            const result = await client.refresh({ refreshToken: "r-jwt" });

            expect(result).toEqual(expected);
            expect(fetchMock.mock.calls[0][0]).toBe("https://connect.example.com/refresh");
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

            const fetchMock = makeFetch([{
                ok: false,
                status: 400,
                body: { reason: "ApplicationNotFound" },
            }]);
            const client = new ConnectClient({
                baseUrl: "https://connect.example.com",
                fetch: fetchMock as unknown as typeof globalThis.fetch,
            });

            await expect(client.establish({
                applicationAnchor: "missing",
                actions: [],
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

                await client.refresh({ refreshToken: "bad" });
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
});
