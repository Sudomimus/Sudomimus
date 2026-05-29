/**
 * @author Sudomimus Contributors
 * @package Connect
 * @namespace TokenStore
 * @description Token-store.test
 */

import { InMemoryTokenStore, type TokenPair } from "../../src/token-store";

describe("InMemoryTokenStore", () => {

    it("starts empty when constructed with no seed", async () => {

        const store = new InMemoryTokenStore();

        expect(await store.load()).toBeNull();
    });

    it("returns the initial pair passed to the constructor", async () => {

        const initial: TokenPair = { accessToken: "a", refreshToken: "r" };
        const store = new InMemoryTokenStore(initial);

        expect(await store.load()).toEqual(initial);
    });

    it("save overwrites the stored pair atomically", async () => {

        const store = new InMemoryTokenStore({ accessToken: "a1", refreshToken: "r1" });

        await store.save({ accessToken: "a2", refreshToken: "r2" });

        expect(await store.load()).toEqual({ accessToken: "a2", refreshToken: "r2" });
    });

    it("save defensively copies the input", async () => {

        const input = { accessToken: "a", refreshToken: "r" };
        const store = new InMemoryTokenStore();

        await store.save(input);
        (input as { accessToken: string }).accessToken = "mutated";

        expect((await store.load())?.accessToken).toBe("a");
    });

    it("clear empties the store", async () => {

        const store = new InMemoryTokenStore({ accessToken: "a", refreshToken: "r" });

        await store.clear();

        expect(await store.load()).toBeNull();
    });
});
