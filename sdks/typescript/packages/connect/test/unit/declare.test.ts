/**
 * @author Sudomimus Contributors
 * @package Connect
 * @namespace Declare
 * @description Declare.test
 */

import type { EstablishRequest } from "../../src/declare";

describe("Connect schema-derived types", () => {

    it("exposes EstablishRequest with typed actions", () => {

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
});
