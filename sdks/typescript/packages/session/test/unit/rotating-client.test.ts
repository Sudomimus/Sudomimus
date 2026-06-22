/**
 * @author Sudomimus Contributors
 * @package Session
 * @namespace RotatingClient
 * @description Rotating-client.test
 */

import {
    InMemoryTokenStore,
    RotatingSessionClient,
    SessionApiError,
    SessionClient,
    SessionConfigError,
} from "../../src";
import { makeFetch } from "../helpers/fetch";

const claims = {
    email: { requirement: "OFF", state: "UNKNOWN" },
    firstName: { requirement: "OPTIONAL", state: "GRANTED" },
    lastName: { requirement: "OFF", state: "UNKNOWN" },
} as const;

const newClient = (fetch: jest.Mock): SessionClient =>
    new SessionClient({
        baseUrl: "https://session.example.com",
        fetch: fetch as unknown as typeof globalThis.fetch,
    });

describe("RotatingSessionClient", () => {

    it("starts empty and seed persists the initial pair", async () => {

        const wrapper = new RotatingSessionClient(
            newClient(makeFetch([])),
            new InMemoryTokenStore(),
        );

        expect(await wrapper.getAccessToken()).toBeNull();
        await wrapper.seed({ accessToken: "a1", refreshToken: "r1" });
        expect(await wrapper.getAccessToken()).toBe("a1");
        expect(await wrapper.getTokens()).toEqual({ accessToken: "a1", refreshToken: "r1" });
    });

    it("refresh rotates the pair and persists it", async () => {

        const fetchMock = makeFetch([
            { ok: true, status: 200, body: { accessToken: "a2", refreshToken: "r2", claims } },
        ]);
        const store = new InMemoryTokenStore({ accessToken: "a1", refreshToken: "r1" });
        const wrapper = new RotatingSessionClient(newClient(fetchMock), store);

        await expect(wrapper.refresh()).resolves.toBe("a2");
        expect(await store.load()).toEqual({ accessToken: "a2", refreshToken: "r2" });
        expect(fetchMock.mock.calls[0][0]).toBe("https://session.example.com/refresh");
    });

    it("throws SessionConfigError when the store is empty", async () => {

        const fetchMock = makeFetch([]);
        const wrapper = new RotatingSessionClient(newClient(fetchMock), new InMemoryTokenStore());

        await expect(wrapper.refresh()).rejects.toBeInstanceOf(SessionConfigError);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("coalesces concurrent refresh calls", async () => {

        const fetchMock = makeFetch([
            { ok: true, status: 200, body: { accessToken: "a2", refreshToken: "r2", claims } },
        ]);
        const wrapper = new RotatingSessionClient(
            newClient(fetchMock),
            new InMemoryTokenStore({ accessToken: "a1", refreshToken: "r1" }),
        );

        const [first, second, third] = await Promise.all([
            wrapper.refresh(),
            wrapper.refresh(),
            wrapper.refresh(),
        ]);

        expect([first, second, third]).toEqual(["a2", "a2", "a2"]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("does not persist when refresh fails", async () => {

        const fetchMock = makeFetch([
            { ok: false, status: 401, body: { reason: "RefreshTokenExpired" } },
        ]);
        const store = new InMemoryTokenStore({ accessToken: "a1", refreshToken: "r1" });
        const wrapper = new RotatingSessionClient(newClient(fetchMock), store);

        await expect(wrapper.refresh()).rejects.toBeInstanceOf(SessionApiError);
        expect(await store.load()).toEqual({ accessToken: "a1", refreshToken: "r1" });
    });

    it("logout calls /logout and clears the store", async () => {

        const fetchMock = makeFetch([{ ok: true, status: 200, body: { revoked: true } }]);
        const store = new InMemoryTokenStore({ accessToken: "a1", refreshToken: "r1" });
        const wrapper = new RotatingSessionClient(newClient(fetchMock), store);

        await wrapper.logout();

        expect(fetchMock.mock.calls[0][0]).toBe("https://session.example.com/logout");
        expect(await store.load()).toBeNull();
    });
});
