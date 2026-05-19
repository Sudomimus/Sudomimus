/**
 * @author Sudomimus Contributors
 * @package Token
 * @namespace Error
 * @description Error.test
 */

import { TokenError } from "../../src/error";

describe("TokenError", () => {

    it("carries a stable code", () => {

        const err = new TokenError("EXPIRED", "x");
        expect(err.code).toBe("EXPIRED");
        expect(err.name).toBe("TokenError");
        expect(err).toBeInstanceOf(Error);
    });

    it("uses the provided message", () => {

        const err = new TokenError("INVALID_JWT", "bad token");
        expect(err.message).toBe("bad token");
    });
});
