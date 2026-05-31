/**
 * @author Sudomimus Contributors
 * @package Token
 * @namespace Id
 * @description OIDC id_token and userinfo
 */

import { JWTToken } from "@sudoo/jwt";
import { TokenError } from "./error";

export type IdTokenHeader = {

    readonly alg?: string;
    readonly typ?: string;

    /** Key id of the platform signing key — match against the OIDC JWKS. */
    readonly kid?: string;
};

/**
 * Decoded claims of a Sudomimus OIDC `id_token`. Unlike Sudomimus access /
 * refresh tokens (whose envelope claims live in the JWT header), an id_token
 * is a standard OIDC JWT: every claim below lives in the JWT *body*, and the
 * token is signed by the **platform** key (resolve it from the OIDC JWKS by
 * the header `kid`), not by the application's signing key.
 */
export type IdTokenBody = {

    readonly iss: string;

    /**
     * The subject — the per-(account, sector) **sector subject**, identical
     * to the access-token body `subject`. Opaque: never parse it.
     */
    readonly sub: string;
    readonly aud: string;
    readonly iat: number;
    readonly exp: number;
    readonly at_hash?: string;
    readonly nonce?: string;
    readonly auth_time?: number;
    readonly email?: string;
    readonly email_verified?: boolean;
    readonly name?: string;
    readonly amr?: ReadonlyArray<string>;
    readonly acr?: string;
};

export type IdToken = JWTToken<IdTokenHeader, IdTokenBody>;

/**
 * Decoded response of the OIDC `/userinfo` endpoint. `sub` is the same sector
 * subject carried by the id_token; the remaining claims are scope-gated by the
 * access token presented to `/userinfo`.
 */
export type UserInfoResponse = {

    readonly sub: string;
    readonly email?: string;
    readonly email_verified?: boolean;
    readonly name?: string;
};

export type VerifyIdTokenExpectations = {

    /** When set, the id_token `aud` must equal this client id. */
    readonly audience?: string;

    /** When set, the id_token `iss` must equal this issuer. */
    readonly issuer?: string;

    /** When set, the id_token `nonce` must equal the value sent at `/authorize`. */
    readonly nonce?: string;

    /** Clock used for the `exp` check. Defaults to `new Date()`. */
    readonly now?: Date;
};

export const parseIdToken = (jwt: string): IdToken | null => {

    return JWTToken.fromTokenOrNull<IdTokenHeader, IdTokenBody>(jwt);
};

/**
 * Verify a Sudomimus OIDC `id_token` against a platform public key (resolved
 * from the OIDC JWKS). Checks the RS256 signature, body `exp`, and any of the
 * supplied audience / issuer / nonce expectations. Returns the parsed token or
 * throws a {@link TokenError}.
 */
export const verifyIdToken = (
    jwt: string,
    platformPublicKeyPem: string,
    expectations: VerifyIdTokenExpectations = {},
): IdToken => {

    const parsed: IdToken | null = parseIdToken(jwt);

    if (parsed === null) {

        throw new TokenError("INVALID_JWT", "id_token is not a parseable JWT.");
    }

    const now: Date = expectations.now ?? new Date();

    if (typeof parsed.body.exp !== "number" || parsed.body.exp * 1000 <= now.getTime()) {

        throw new TokenError("EXPIRED", "id_token has expired.");
    }

    if (!parsed.verifySignature(platformPublicKeyPem)) {

        throw new TokenError(
            "INVALID_SIGNATURE",
            "id_token signature does not match the platform public key.",
        );
    }

    if (typeof expectations.audience === "string" && parsed.body.aud !== expectations.audience) {

        throw new TokenError("WRONG_AUDIENCE", "id_token `aud` does not match the expected client id.");
    }

    if (typeof expectations.issuer === "string" && parsed.body.iss !== expectations.issuer) {

        throw new TokenError("WRONG_ISSUER", "id_token `iss` does not match the expected issuer.");
    }

    if (typeof expectations.nonce === "string" && parsed.body.nonce !== expectations.nonce) {

        throw new TokenError("WRONG_NONCE", "id_token `nonce` does not match the value sent at /authorize.");
    }

    return parsed;
};
