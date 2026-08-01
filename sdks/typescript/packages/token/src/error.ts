/**
 * @author Sudomimus Contributors
 * @package Token
 * @namespace Error
 * @description Token error class
 */

export type TokenErrorCode =
    | "INVALID_JWT"
    | "WRONG_TOKEN_TYPE"
    | "MISSING_AUDIENCE"
    | "MISSING_KEY_ID"
    | "UNKNOWN_KEY_ID"
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
