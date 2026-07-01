/**
 * @author Sudomimus Contributors
 * @package Session
 * @namespace Declare
 * @description Declare.test
 */

import { INTROSPECT_STATUS, type RefreshResponse } from "../../src";

describe("Session schema-derived types", () => {

    it("accepts refresh responses with claims", () => {

        const response: RefreshResponse = {
            accessToken: "a",
            refreshToken: "r",
            claims: {
                email: { requirement: "OFF", state: "UNKNOWN" },
                firstName: { requirement: "OPTIONAL", state: "GRANTED" },
                lastName: { requirement: "REQUIRED", state: "DENIED" },
                avatar: { requirement: "OFF", state: "UNKNOWN" },
            },
        };

        expect(response.claims.firstName.state).toBe("GRANTED");
    });

    it("exposes introspect status constants", () => {

        expect(INTROSPECT_STATUS.ACTIVE).toBe("active");
        expect(INTROSPECT_STATUS.NOT_FOUND).toBe("not_found");
    });
});
