/**
 * @author Sudomimus Contributors
 * @package Native
 * @namespace Client
 * @description Client.test
 */

import { NativeClient } from "../../src/client";

describe("NativeClient", () => {

    it("normalizes the base URL", () => {

        const client = new NativeClient({
            baseUrl: "https://native.example.com/",
        });

        expect(client.baseUrl).toBe("https://native.example.com");
    });
});
