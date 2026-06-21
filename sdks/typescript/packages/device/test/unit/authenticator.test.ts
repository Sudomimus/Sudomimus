/**
 * @author Sudomimus Contributors
 * @package Device
 * @namespace Authenticator
 * @description Authenticator.test
 */

import { InMemoryTokenStore } from "@sudomimus/connect";
import {
    DeviceAuthenticator,
    DeviceClient,
    DevicePollTimeoutError,
    DeviceTokenApiError,
} from "../../src";
import type {
    DeviceAuthorizeResponse,
    DeviceTokenResponse,
} from "../../src";
import { makeFetch } from "../helpers/fetch";

const authorizationResponse = (overrides: Partial<DeviceAuthorizeResponse> = {}): DeviceAuthorizeResponse => ({
    applicationAnchor: "my-app",
    deviceCode: "dvc_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    userCode: "ABCD-1234",
    verificationUri: "https://sudomimus.com/device",
    verificationUriComplete: "https://sudomimus.com/device?user_code=ABCD-1234",
    expiresIn: 600,
    interval: 5,
    ...overrides,
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

const newClient = (fetch: jest.Mock): DeviceClient =>
    new DeviceClient({
        baseUrl: "https://device.example.com",
        fetch: fetch as unknown as typeof globalThis.fetch,
    });

describe("DeviceAuthenticator", () => {

    it("authorizes, opens the verification URL, polls, and persists tokens", async () => {

        const authorization = authorizationResponse();
        const tokens = tokenResponse();
        const fetchMock = makeFetch([
            { ok: true, status: 200, body: authorization },
            { ok: false, status: 400, body: { error: "authorization_pending" } },
            { ok: true, status: 200, body: tokens },
        ]);
        const store = new InMemoryTokenStore();
        const openUrl = jest.fn();
        const sleep = jest.fn(async () => undefined);
        const progress = jest.fn();
        const authenticator = new DeviceAuthenticator(newClient(fetchMock), {
            store,
            openUrl,
            sleep,
        });

        const result = await authenticator.authorizeAndPoll(
            { applicationAnchor: "my-app" },
            { onPoll: progress },
        );

        expect(result).toEqual({ authorization, tokens });
        expect(openUrl).toHaveBeenCalledWith(authorization.verificationUriComplete, authorization);
        expect(progress).toHaveBeenCalledWith({
            authorization,
            attempt: 1,
            error: "authorization_pending",
            nextIntervalSeconds: 5,
        });
        expect(sleep).toHaveBeenCalledWith(5000, undefined);
        expect(await store.load()).toEqual({
            accessToken: "access.jwt",
            refreshToken: "refresh.jwt",
        });
    });

    it("supports automatic polling without a store", async () => {

        const authorization = authorizationResponse();
        const tokens = tokenResponse();
        const fetchMock = makeFetch([
            { ok: false, status: 400, body: { error: "authorization_pending" } },
            { ok: true, status: 200, body: tokens },
        ]);
        const authenticator = new DeviceAuthenticator(newClient(fetchMock), {
            sleep: async () => undefined,
        });

        const result = await authenticator.pollForToken(authorization);

        expect(result).toEqual(tokens);
    });

    it("honors slow_down interval updates", async () => {

        const authorization = authorizationResponse({ interval: 2 });
        const tokens = tokenResponse();
        const fetchMock = makeFetch([
            { ok: false, status: 400, body: { error: "slow_down", interval: 9 } },
            { ok: true, status: 200, body: tokens },
        ]);
        const sleep = jest.fn(async () => undefined);
        const authenticator = new DeviceAuthenticator(newClient(fetchMock), { sleep });

        await authenticator.pollForToken(authorization);

        expect(sleep).toHaveBeenCalledWith(9000, undefined);
    });

    it("surfaces terminal token errors", async () => {

        const authorization = authorizationResponse();
        const fetchMock = makeFetch([
            { ok: false, status: 400, body: { error: "access_denied" } },
        ]);
        const authenticator = new DeviceAuthenticator(newClient(fetchMock), {
            sleep: async () => undefined,
        });

        await expect(authenticator.pollForToken(authorization))
            .rejects
            .toBeInstanceOf(DeviceTokenApiError);
    });

    it("times out before polling beyond the deadline", async () => {

        let now = 1000;
        const authorization = authorizationResponse({ expiresIn: 1 });
        const fetchMock = makeFetch([
            { ok: false, status: 400, body: { error: "authorization_pending" } },
        ]);
        const authenticator = new DeviceAuthenticator(newClient(fetchMock), {
            now: () => now,
            sleep: async () => {
                now = 3000;
            },
        });

        await expect(authenticator.pollForToken(authorization))
            .rejects
            .toBeInstanceOf(DevicePollTimeoutError);
    });

    it("reads tokens from its configured store", async () => {

        const store = new InMemoryTokenStore();
        const authenticator = new DeviceAuthenticator(newClient(makeFetch([])), { store });

        expect(await authenticator.getTokens()).toBeNull();

        await authenticator.seed({ accessToken: "a1", refreshToken: "r1" });

        expect(await authenticator.getAccessToken()).toBe("a1");
        expect(await authenticator.getTokens()).toEqual({ accessToken: "a1", refreshToken: "r1" });
    });
});
