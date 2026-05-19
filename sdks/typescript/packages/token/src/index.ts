/**
 * @author Sudomimus Contributors
 * @package Token
 * @namespace Root
 * @description Index
 */

import { JWTToken } from "@sudoo/jwt";

export type AccessTokenHeader = Record<string, never>;

export type AccessTokenBody = {

    readonly accountIdentifier: string;
    readonly firstName: string;
    readonly lastName?: string;
};

export type RefreshTokenHeader = Record<string, never>;

export type RefreshTokenBody = {

    readonly accountIdentifier: string;
};

export type AccessToken = JWTToken<AccessTokenHeader, AccessTokenBody>;
export type RefreshToken = JWTToken<RefreshTokenHeader, RefreshTokenBody>;

export const ACCESS_TOKEN_KEY_TYPE = "Access";
export const REFRESH_TOKEN_KEY_TYPE = "Refresh";

export const parseAccessToken = (jwt: string): AccessToken | null => {

    return JWTToken.fromTokenOrNull<AccessTokenHeader, AccessTokenBody>(jwt);
};

export const parseRefreshToken = (jwt: string): RefreshToken | null => {

    return JWTToken.fromTokenOrNull<RefreshTokenHeader, RefreshTokenBody>(jwt);
};

export type TokenErrorCode =
    | "INVALID_JWT"
    | "WRONG_KEY_TYPE"
    | "MISSING_AUDIENCE"
    | "EXPIRED"
    | "INVALID_SIGNATURE";

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

export type PublicKeyResolver = (applicationAnchor: string) => Promise<string>;

export interface TokenVerifierOptions {
    resolver: PublicKeyResolver;
}

export class TokenVerifier {

    private readonly _resolver: PublicKeyResolver;

    public constructor(options: TokenVerifierOptions) {

        this._resolver = options.resolver;
    }

    public async verifyAccessToken(jwt: string): Promise<AccessToken> {

        return this._verify(jwt, ACCESS_TOKEN_KEY_TYPE, parseAccessToken) as Promise<AccessToken>;
    }

    public async verifyRefreshToken(jwt: string): Promise<RefreshToken> {

        return this._verify(jwt, REFRESH_TOKEN_KEY_TYPE, parseRefreshToken) as Promise<RefreshToken>;
    }

    private async _verify(
        jwt: string,
        expectedKeyType: string,
        parser: (jwt: string) => AccessToken | RefreshToken | null,
    ): Promise<AccessToken | RefreshToken> {

        const parsed: AccessToken | RefreshToken | null = parser(jwt);

        if (parsed === null) {

            throw new TokenError("INVALID_JWT", "Token is not a parseable JWT.");
        }

        if (parsed.header.kty !== expectedKeyType) {

            throw new TokenError(
                "WRONG_KEY_TYPE",
                `Expected key type "${expectedKeyType}", got "${parsed.header.kty ?? ""}".`,
            );
        }

        const audience: string | undefined = parsed.header.aud;

        if (typeof audience !== "string" || audience.length === 0) {

            throw new TokenError(
                "MISSING_AUDIENCE",
                "Token is missing the `aud` (applicationAnchor) header.",
            );
        }

        if (!parsed.verifyExpiration(new Date())) {

            throw new TokenError("EXPIRED", "Token has expired.");
        }

        const publicKey: string = await this._resolver(audience);

        if (!parsed.verifySignature(publicKey)) {

            throw new TokenError(
                "INVALID_SIGNATURE",
                "Token signature does not match the application public key.",
            );
        }

        return parsed;
    }
}
