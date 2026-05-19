/**
 * @author Sudomimus Contributors
 * @package Native
 * @namespace Declare
 * @description Declare.test
 */

import type { StatusPollRequest } from "../../src/declare";

describe("Native schema-derived types", () => {

    it("exposes StatusPollRequest with a pollToken field", () => {

        const request: StatusPollRequest = {
            pollToken: "poll-token",
        };

        expect(request.pollToken).toBe("poll-token");
    });
});
