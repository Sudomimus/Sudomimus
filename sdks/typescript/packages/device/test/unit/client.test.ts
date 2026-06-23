/**
 * @author Sudomimus Contributors
 * @package Device
 * @namespace Client
 * @description Client.test
 */

import {
    DeviceApiError,
    DeviceClient,
    DeviceTokenApiError,
    PRODUCTION_BASE_URL,
} from "../../src";
import type {
    DeviceAuthorizeResponse,
    DeviceTokenResponse,
    HealthResponse,
} from "../../src";
import { makeFetch } from "../helpers/fetch";

const authorizationResponse = (): DeviceAuthorizeResponse => ({
    applicationAnchor: "my-app",
    deviceCode: "dvc_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    userCode: "ABCD-1234",
    verificationUri: "https://sudomimus.com/device",
    verificationUriComplete: "https://sudomimus.com/device?user_code=ABCD-1234",
    expiresIn: 600,
    interval: 5,
});

const tokenResponse = (): DeviceTokenResponse => ({
    applicationAnchor: "my-app",
    accessToken: "access.jwt",
    refreshToken: "refresh.jwt",
    claims: {
        email: { requirement: "OFF", state: "UNKNOWN" },
        firstName: { requirement: "OPTIONAL", state: "GRANTED" },
        lastName: { requirement: "OPTIONAL", state: "DENIED" },
    },
});

describe("DeviceClient", () => {

    it("defaults to the production base URL", () => {

        expect(new DeviceClient().baseUrl).toBe(PRODUCTION_BASE_URL);
    });

    it("normalizes the base URL", () => {

        const client = new DeviceClient({
            baseUrl: "https://device.example.com/",
        });

        expect(client.baseUrl).toBe("https://device.example.com");
    });

    it("GETs /health", async () => {

        const expected: HealthResponse = {
            ready: true,
            service: "device",
            version: "1.0.0",
        };
        const fetchMock = makeFetch([{ ok: true, status: 200, body: expected }]);
        const client = new DeviceClient({
            baseUrl: "https://device.example.com",
            fetch: fetchMock as unknown as typeof globalThis.fetch,
        });

        const result = await client.health();

        expect(result).toEqual(expected);
        expect(fetchMock.mock.calls[0][0]).toBe("https://device.example.com/health");
        expect(fetchMock.mock.calls[0][1]).toEqual({
            method: "GET",
            headers: { "Accept": "application/json" },
        });
    });

    it("POSTs /device-authorize", async () => {

        const expected = authorizationResponse();
        const fetchMock = makeFetch([{ ok: true, status: 200, body: expected }]);
        const client = new DeviceClient({
            baseUrl: "https://device.example.com",
            fetch: fetchMock as unknown as typeof globalThis.fetch,
        });

        const result = await client.deviceAuthorize({ applicationAnchor: "my-app" });

        expect(result).toEqual(expected);
        expect(fetchMock.mock.calls[0][0]).toBe("https://device.example.com/device-authorize");
        expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
            applicationAnchor: "my-app",
        });
    });

    it("POSTs /device-token", async () => {

        const expected = tokenResponse();
        const fetchMock = makeFetch([{ ok: true, status: 200, body: expected }]);
        const client = new DeviceClient({
            baseUrl: "https://device.example.com",
            fetch: fetchMock as unknown as typeof globalThis.fetch,
        });

        const result = await client.deviceToken({ deviceCode: "dvc_abc" });

        expect(result).toEqual(expected);
        expect(fetchMock.mock.calls[0][0]).toBe("https://device.example.com/device-token");
        expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
            deviceCode: "dvc_abc",
        });
    });

    it("throws DeviceTokenApiError for device-flow errors", async () => {

        const fetchMock = makeFetch([
            { ok: false, status: 400, body: { error: "slow_down", interval: 8 } },
        ]);
        const client = new DeviceClient({
            baseUrl: "https://device.example.com",
            fetch: fetchMock as unknown as typeof globalThis.fetch,
        });

        await expect(client.deviceToken({ deviceCode: "dvc_abc" })).rejects.toMatchObject({
            name: "DeviceTokenApiError",
            status: 400,
            error: "slow_down",
            interval: 8,
        });
    });

    it("throws DeviceApiError for generic API errors", async () => {

        const fetchMock = makeFetch([
            { ok: false, status: 403, body: { reason: "Layer3Denied" } },
        ]);
        const client = new DeviceClient({
            baseUrl: "https://device.example.com",
            fetch: fetchMock as unknown as typeof globalThis.fetch,
        });

        await expect(client.deviceAuthorize({ applicationAnchor: "my-app" }))
            .rejects
            .toBeInstanceOf(DeviceApiError);
    });

    it("exports the token error class", () => {

        expect(new DeviceTokenApiError(400, { error: "authorization_pending" }))
            .toBeInstanceOf(Error);
    });
});
