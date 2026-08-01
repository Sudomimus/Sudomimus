/**
 * @author Sudomimus Contributors
 * @package Token
 * @namespace Verifier
 * @description Token verifier
 */

import { ACCESS_TOKEN_TYPE, REFRESH_TOKEN_TYPE } from "./constants.js";
import type {
    AccessToken,
    PublicKeyResolver,
    RefreshToken,
    TokenVerifierOptions,
} from "./declare.js";
import { TokenError } from "./error.js";
import {
    parseAccessToken,
    parseRefreshToken,
    peekTokenBody,
    peekTokenHeader,
} from "./parse.js";

export class TokenVerifier {

    private readonly _resolver: PublicKeyResolver;

    public constructor(options: TokenVerifierOptions) {

        this._resolver = options.resolver;
    }

    public async verifyAccessToken(jwt: string): Promise<AccessToken> {

        return this._verify(jwt, ACCESS_TOKEN_TYPE, parseAccessToken) as Promise<AccessToken>;
    }

    public async verifyRefreshToken(jwt: string): Promise<RefreshToken> {

        return this._verify(jwt, REFRESH_TOKEN_TYPE, parseRefreshToken) as Promise<RefreshToken>;
    }

    private async _verify(
        jwt: string,
        expectedTokenType: string,
        parser: (jwt: string) => AccessToken | RefreshToken | null,
    ): Promise<AccessToken | RefreshToken> {

        const header = peekTokenHeader(jwt);
        const body = peekTokenBody(jwt);

        if (header === null || body === null) {

            throw new TokenError("INVALID_JWT", "Token is not a parseable JWT.");
        }

        if (header.typ !== expectedTokenType) {

            throw new TokenError(
                "WRONG_TOKEN_TYPE",
                `Expected token type "${expectedTokenType}", got "${String(header.typ ?? "")}".`,
            );
        }

        const audience = body.aud;

        if (typeof audience !== "string" || audience.length === 0) {

            throw new TokenError(
                "MISSING_AUDIENCE",
                "Token is missing the `aud` (applicationAnchor) payload claim.",
            );
        }

        const keyId = header.kid;

        if (typeof keyId !== "string" || keyId.length === 0) {

            throw new TokenError(
                "MISSING_KEY_ID",
                "Token is missing the `kid` signing-key identifier.",
            );
        }

        const parsed: AccessToken | RefreshToken | null = parser(jwt);

        if (parsed === null) {

            throw new TokenError("INVALID_JWT", "Token claims do not match the 4.0.0 contract.");
        }

        if (!parsed.verifyExpiration(new Date())) {

            throw new TokenError("EXPIRED", "Token has expired.");
        }

        const publicKey: string = await this._resolver(audience, keyId);

        if (!parsed.verifySignature(publicKey)) {

            throw new TokenError(
                "INVALID_SIGNATURE",
                "Token signature does not match the application public key.",
            );
        }

        return parsed;
    }
}
