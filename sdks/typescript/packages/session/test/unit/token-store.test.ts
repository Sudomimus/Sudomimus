/**
 * @author WMXPY
 * @package Session
 * @namespace Test_Unit
 * @description Token Store.test
 */

import { InMemoryTokenStore } from "../../src";

describe("InMemoryTokenStore", () => {

    it("loads, saves, overwrites, and clears a token pair", async () => {

        const store = new InMemoryTokenStore();

        expect(await store.load()).toBeNull();
        await store.save({ accessToken: "a1", refreshToken: "r1" });
        expect(await store.load()).toEqual({ accessToken: "a1", refreshToken: "r1" });
        await store.save({ accessToken: "a2", refreshToken: "r2" });
        expect(await store.load()).toEqual({ accessToken: "a2", refreshToken: "r2" });
        await store.clear();
        expect(await store.load()).toBeNull();
    });
});
