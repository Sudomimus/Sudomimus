/**
 * @author Sudomimus Contributors
 * @package Connect
 * @namespace Error
 * @description Error.test
 */

import { ConnectApiError } from "../../src/error";

describe("ConnectApiError", () => {

    it("formats message with reason when provided", () => {

        const err = new ConnectApiError(400, "ApplicationNotFound", {
            reason: "ApplicationNotFound",
        });

        expect(err.name).toBe("ConnectApiError");
        expect(err.status).toBe(400);
        expect(err.reason).toBe("ApplicationNotFound");
        expect(err.message).toBe("Connect API error 400: ApplicationNotFound");
        expect(err).toBeInstanceOf(Error);
    });

    it("formats message without reason when undefined", () => {

        const err = new ConnectApiError(500, undefined, undefined);

        expect(err.status).toBe(500);
        expect(err.reason).toBeUndefined();
        expect(err.body).toBeUndefined();
        expect(err.message).toBe("Connect API error 500");
    });
});
