/**
 * @author Sudomimus Contributors
 * @package Native
 * @namespace Declare
 * @description Declare.test
 */

import {
    STEAM_TICKET_IDENTITY,
    type DirectIssueSteamTicketRequest,
    type DirectIssueSteamTicketResponse,
} from "../../src";

describe("Native schema-derived types", () => {

    it("exposes DirectIssueSteamTicketRequest with the expected fields", () => {

        const request: DirectIssueSteamTicketRequest = {
            applicationAnchor: "anchor-1",
            steamTicketHex: "deadbeef",
            steamAppId: 480,
        };

        expect(request.applicationAnchor).toBe("anchor-1");
        expect(request.steamTicketHex).toBe("deadbeef");
        expect(request.steamAppId).toBe(480);
    });

    it("exposes DirectIssueSteamTicketResponse with token fields", () => {

        const response: DirectIssueSteamTicketResponse = {
            applicationAnchor: "anchor-1",
            accessToken: "a-jwt",
            refreshToken: "r-jwt",
        };

        expect(response.accessToken).toBe("a-jwt");
        expect(response.refreshToken).toBe("r-jwt");
    });

    it("exports the Steam ticket identity string the client SDK must use", () => {

        // Server-side code in clients/native-api/src/steam/verify-ticket.ts
        // hardcodes the same value. Drift here breaks all Steam logins.
        expect(STEAM_TICKET_IDENTITY).toBe("sudomimus");
    });
});
