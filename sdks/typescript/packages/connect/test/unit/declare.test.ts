/**
 * @author Sudomimus Contributors
 * @package Connect
 * @namespace Declare
 * @description Declare.test
 */

import {
    AUTHENTICATION_METHOD,
    REALIZE_CONSTRAINT_TYPE,
    RETURN_METHOD,
    type EstablishRequest,
} from "../../src/declare";

describe("Connect schema-derived types", () => {

    it("accepts a minimal EstablishRequest with just applicationAnchor", () => {

        const request: EstablishRequest = {
            applicationAnchor: "anchor-1",
        };

        expect(request.applicationAnchor).toBe("anchor-1");
    });

    it("accepts authenticationConstraints, realizeConstraints, and returnMethods", () => {

        const request: EstablishRequest = {
            applicationAnchor: "anchor-1",
            authenticationConstraints: [
                { method: AUTHENTICATION_METHOD.PASSKEY_USERNAMELESS, payload: {} },
            ],
            realizeConstraints: [
                {
                    constraintType: REALIZE_CONSTRAINT_TYPE.EMAIL,
                    payload: { allowedEmails: ["*@example.com"] },
                },
            ],
            returnMethods: [
                { type: RETURN_METHOD.CALLBACK, payload: { callbackUrl: "https://example.com/cb" } },
                { type: RETURN_METHOD.STATUS_POLL, payload: {} },
                { type: RETURN_METHOD.REVEAL, payload: {} },
            ],
        };

        expect(request.authenticationConstraints).toHaveLength(1);
        expect(request.realizeConstraints?.[0].constraintType).toBe("EMAIL");
        expect(request.returnMethods?.[0].type).toBe("CALLBACK");
    });

    it("exposes the new enum constants with the right literal values", () => {

        expect(AUTHENTICATION_METHOD.PASSKEY_USERNAMELESS).toBe("PASSKEY_USERNAMELESS");
        expect(AUTHENTICATION_METHOD.PASSKEY_REASONED).toBe("PASSKEY_REASONED");
        expect(AUTHENTICATION_METHOD.EMAIL_VERIFICATION).toBe("EMAIL_VERIFICATION");
        expect(REALIZE_CONSTRAINT_TYPE.EMAIL).toBe("EMAIL");
        expect(RETURN_METHOD.CALLBACK).toBe("CALLBACK");
        expect(RETURN_METHOD.STATUS_POLL).toBe("STATUS_POLL");
        expect(RETURN_METHOD.REVEAL).toBe("REVEAL");
    });
});
