/**
 * @author Sudomimus Contributors
 * @package Token
 * @namespace Error
 * @description Token error class
 */

export type TokenErrorCode =
    | "INVALID_JWT"
    | "WRONG_KEY_TYPE"
    | "MISSING_AUDIENCE"
    | "EXPIRED"
    | "INVALID_SIGNATURE"
    | "WRONG_AUDIENCE"
    | "WRONG_ISSUER"
    | "WRONG_NONCE";

export class TokenError extends Error {

    public readonly code: TokenErrorCode;

    public constructor(
        code: TokenErrorCode,
        message: string,
    ) {

        super(message);
        this.name = "TokenError";
        this.code = code;
    }
}
