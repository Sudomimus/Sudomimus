/**
 * @author Sudomimus Contributors
 * @package Connect
 * @namespace RotatingClient
 * @description Rotating-client.test
 */

import {
    ConnectApiError,
    ConnectClient,
    ConnectConfigError,
    InMemoryTokenStore,
    RotatingConnectClient,
} from "../../src";
import { makeFetch } from "../helpers/fetch";

const newClient = (fetch: jest.Mock): ConnectClient =>
    new ConnectClient({
        baseUrl: "https://connect.example.com",
        fetch: fetch as unknown as typeof globalThis.fetch,
    });

describe("RotatingConnectClient", () => {

    describe("seed / getAccessToken / getTokens", () => {

        it("starts empty and returns null from accessors", async () => {

            const wrapper = new RotatingConnectClient(
                newClient(makeFetch([])),
                new InMemoryTokenStore(),
            );

            expect(await wrapper.getAccessToken()).toBeNull();
            expect(await wrapper.getTokens()).toBeNull();
        });

        it("seed persists the initial pair", async () => {

            const wrapper = new RotatingConnectClient(
                newClient(makeFetch([])),
                new InMemoryTokenStore(),
            );

            await wrapper.seed({ accessToken: "a1", refreshToken: "r1" });

            expect(await wrapper.getAccessToken()).toBe("a1");
            expect(await wrapper.getTokens()).toEqual({ accessToken: "a1", refreshToken: "r1" });
        });
    });

    describe("refresh", () => {

        it("rotates the pair and persists the new pair", async () => {

            const fetchMock = makeFetch([
                { ok: true, status: 200, body: { accessToken: "a2", refreshToken: "r2" } },
            ]);
            const store = new InMemoryTokenStore({ accessToken: "a1", refreshToken: "r1" });
            const wrapper = new RotatingConnectClient(newClient(fetchMock), store);

            const next = await wrapper.refresh();

            expect(next).toBe("a2");
            expect(await store.load()).toEqual({ accessToken: "a2", refreshToken: "r2" });
            const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
            expect(sentBody).toEqual({ refreshToken: "r1" });
        });

        it("throws ConnectConfigError when the store is empty", async () => {

            const fetchMock = makeFetch([]);
            const wrapper = new RotatingConnectClient(
                newClient(fetchMock),
                new InMemoryTokenStore(),
            );

            await expect(wrapper.refresh()).rejects.toBeInstanceOf(ConnectConfigError);
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it("coalesces concurrent refresh calls onto one in-flight /refresh", async () => {

            const fetchMock = makeFetch([
                { ok: true, status: 200, body: { accessToken: "a2", refreshToken: "r2" } },
            ]);
            const wrapper = new RotatingConnectClient(
                newClient(fetchMock),
                new InMemoryTokenStore({ accessToken: "a1", refreshToken: "r1" }),
            );

            const [first, second, third] = await Promise.all([
                wrapper.refresh(),
                wrapper.refresh(),
                wrapper.refresh(),
            ]);

            expect(first).toBe("a2");
            expect(second).toBe("a2");
            expect(third).toBe("a2");
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it("releases the in-flight slot after a successful refresh", async () => {

            const fetchMock = makeFetch([
                { ok: true, status: 200, body: { accessToken: "a2", refreshToken: "r2" } },
                { ok: true, status: 200, body: { accessToken: "a3", refreshToken: "r3" } },
            ]);
            const wrapper = new RotatingConnectClient(
                newClient(fetchMock),
                new InMemoryTokenStore({ accessToken: "a1", refreshToken: "r1" }),
            );

            await wrapper.refresh();
            const next = await wrapper.refresh();

            expect(next).toBe("a3");
            expect(fetchMock).toHaveBeenCalledTimes(2);
            const secondSentBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
            expect(secondSentBody).toEqual({ refreshToken: "r2" });
        });

        it("releases the in-flight slot after a failed refresh and propagates the error", async () => {

            const fetchMock = makeFetch([
                { ok: false, status: 401, body: { reason: "RefreshTokenFamilyCompromised" } },
                { ok: true, status: 200, body: { accessToken: "a2", refreshToken: "r2" } },
            ]);
            const wrapper = new RotatingConnectClient(
                newClient(fetchMock),
                new InMemoryTokenStore({ accessToken: "a1", refreshToken: "r1" }),
            );

            await expect(wrapper.refresh()).rejects.toBeInstanceOf(ConnectApiError);

            // The second refresh should be allowed to run (e.g. after the
            // caller re-authenticates and seed()s a new pair).
            const next = await wrapper.refresh();
            expect(next).toBe("a2");
        });

        it("does not persist a new pair when the /refresh call fails", async () => {

            const fetchMock = makeFetch([
                { ok: false, status: 401, body: { reason: "RefreshTokenExpired" } },
            ]);
            const store = new InMemoryTokenStore({ accessToken: "a1", refreshToken: "r1" });
            const wrapper = new RotatingConnectClient(newClient(fetchMock), store);

            await expect(wrapper.refresh()).rejects.toBeInstanceOf(ConnectApiError);

            expect(await store.load()).toEqual({ accessToken: "a1", refreshToken: "r1" });
        });
    });

    describe("logout", () => {

        it("calls /logout with the stored refresh token and clears the store", async () => {

            const fetchMock = makeFetch([
                { ok: true, status: 200, body: { revoked: true } },
            ]);
            const store = new InMemoryTokenStore({ accessToken: "a1", refreshToken: "r1" });
            const wrapper = new RotatingConnectClient(newClient(fetchMock), store);

            await wrapper.logout();

            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(fetchMock.mock.calls[0][0]).toBe("https://connect.example.com/logout");
            const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
            expect(sentBody).toEqual({ refreshToken: "r1" });
            expect(await store.load()).toBeNull();
        });

        it("clears the store even when /logout fails server-side", async () => {

            const fetchMock = makeFetch([
                { ok: false, status: 500, body: { reason: "InternalError" } },
            ]);
            const store = new InMemoryTokenStore({ accessToken: "a1", refreshToken: "r1" });
            const wrapper = new RotatingConnectClient(newClient(fetchMock), store);

            await expect(wrapper.logout()).rejects.toBeInstanceOf(ConnectApiError);

            expect(await store.load()).toBeNull();
        });

        it("is a no-op when the store is empty", async () => {

            const fetchMock = makeFetch([]);
            const wrapper = new RotatingConnectClient(
                newClient(fetchMock),
                new InMemoryTokenStore(),
            );

            await wrapper.logout();

            expect(fetchMock).not.toHaveBeenCalled();
        });
    });

    describe("client accessor", () => {

        it("exposes the underlying ConnectClient for non-rotation calls", () => {

            const client = newClient(makeFetch([]));
            const wrapper = new RotatingConnectClient(client, new InMemoryTokenStore());

            expect(wrapper.client).toBe(client);
        });
    });
});
