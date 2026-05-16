/**
 * @author Sudomimus Contributors
 * @package Connect
 * @namespace Root
 * @description Index.test
 */

import { ConnectClient, type EstablishRequest } from "../src";

describe("ConnectClient", () => {

    it("normalizes the base URL", () => {

        const client = new ConnectClient({
            baseUrl: "https://connect.example.com/",
        });

        expect(client.baseUrl).toBe("https://connect.example.com");
    });

    it("exposes generated request types", () => {

        const request: EstablishRequest = {
            applicationKey: "app-key",
            redirectUri: "https://example.com/cb",
        };

        expect(request.applicationKey).toBe("app-key");
    });
});
