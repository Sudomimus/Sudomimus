/**
 * @author Sudomimus Contributors
 * @package Native
 * @namespace Root
 * @description Index.test
 */

import { NativeClient, type StatusPollRequest } from "../src";

describe("NativeClient", () => {

    it("normalizes the base URL", () => {

        const client = new NativeClient({
            baseUrl: "https://native.example.com/",
        });

        expect(client.baseUrl).toBe("https://native.example.com");
    });

    it("exposes generated request types", () => {

        const request: StatusPollRequest = {
            pollToken: "poll-token",
        };

        expect(request.pollToken).toBe("poll-token");
    });
});
