/**
 * @author Sudomimus Contributors
 * @package Native
 * @namespace Declare
 * @description Declare.test
 */

import {
    STEAM_TICKET_IDENTITY,
    type ClaimsStateView,
    type DirectIssueAccessKeyRequest,
    type DirectIssueAccessKeyResponse,
    type DirectIssueDeniedError,
    type DirectIssueSteamTicketRequest,
    type DirectIssueSteamTicketResponse,
    type ErrandStatusResponse,
} from "../../src";

const SAMPLE_CLAIMS: ClaimsStateView = {
    email: { requirement: "REQUIRED", state: "GRANTED" },
    firstName: { requirement: "OFF", state: "UNKNOWN" },
    lastName: { requirement: "OFF", state: "UNKNOWN" },
};

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

    it("exposes DirectIssueSteamTicketResponse with token fields and claims", () => {

        const response: DirectIssueSteamTicketResponse = {
            applicationAnchor: "anchor-1",
            accessToken: "a-jwt",
            refreshToken: "r-jwt",
            claims: SAMPLE_CLAIMS,
        };

        expect(response.accessToken).toBe("a-jwt");
        expect(response.refreshToken).toBe("r-jwt");
        expect(response.claims.email.requirement).toBe("REQUIRED");
        expect(response.claims.email.state).toBe("GRANTED");
    });

    it("exports the Steam ticket identity string the client SDK must use", () => {

        // Server-side code in clients/native-api/src/steam/verify-ticket.ts
        // hardcodes the same value. Drift here breaks all Steam logins.
        expect(STEAM_TICKET_IDENTITY).toBe("sudomimus");
    });

    it("exposes DirectIssueAccessKeyRequest with the expected fields", () => {

        const request: DirectIssueAccessKeyRequest = {
            applicationAnchor: "anchor-1",
            accessKeyIdentifier: "01890c5e-1234-4abc-9def-0123456789ab",
            accessKeySecret: "a".repeat(64),
        };

        expect(request.applicationAnchor).toBe("anchor-1");
        expect(request.accessKeyIdentifier).toMatch(/^[0-9a-f]{8}-/);
        expect(request.accessKeySecret).toHaveLength(64);
    });

    it("exposes DirectIssueAccessKeyResponse with token fields and claims", () => {

        const response: DirectIssueAccessKeyResponse = {
            applicationAnchor: "anchor-1",
            accessToken: "a-jwt",
            refreshToken: "r-jwt",
            claims: SAMPLE_CLAIMS,
        };

        expect(response.accessToken).toBe("a-jwt");
        expect(response.claims.firstName.requirement).toBe("OFF");
    });

    it("exposes the claim-gate 403 body with claims and errand handoff", () => {

        const denied: DirectIssueDeniedError = {
            reason: "ClaimConsentRequired",
            claims: SAMPLE_CLAIMS,
            errand: {
                errandKey: "ernd_courier-route-abcdef012345-seal",
                url: "https://via.sudomimus.com/errand?key=ernd_courier-route-abcdef012345-seal",
                expiresAt: "2026-06-10T12:30:00.000Z",
            },
        };

        expect(denied.reason).toBe("ClaimConsentRequired");
        expect(denied.errand?.errandKey).toMatch(/^ernd_/);
        expect(denied.claims?.email.state).toBe("GRANTED");
    });

    it("exposes ErrandStatusResponse with the polling status values", () => {

        const pending: ErrandStatusResponse = { status: "PENDING" };
        const completed: ErrandStatusResponse = { status: "COMPLETED" };
        const expired: ErrandStatusResponse = { status: "EXPIRED" };

        expect(pending.status).toBe("PENDING");
        expect(completed.status).toBe("COMPLETED");
        expect(expired.status).toBe("EXPIRED");
    });
});
