/**
 * @author Sudomimus Contributors
 * @package Connect
 * @namespace ClientAuth
 * @description Client-auth JWT helpers for /establish
 */

import { JWTCreator } from "@sudoo/jwt";
import * as crypto from "crypto";
import {
    CLIENT_JWT_AUDIENCE,
    CLIENT_JWT_DEFAULT_LIFETIME_SECONDS,
    CLIENT_JWT_MAX_LIFETIME_SECONDS,
} from "./constants";
import type { ConnectClientAuthWithKey } from "./declare";
import { ConnectConfigError } from "./error";

export type EstablishClientJwtClaims = {

    readonly iss: string;
    readonly aud: string;
    readonly iat: number;
    readonly exp: number;
    readonly jti: string;
    readonly body_sha256: string;
};

export type BuildEstablishClientJwtClaimsOptions = {

    readonly lifetimeSeconds?: number;
    readonly jtiGenerator?: () => string;
    readonly now?: Date;
};

/**
 * Server hashes the raw HTTP body with `SHA-256` over UTF-8 bytes and
 * encodes as standard base64. Mirror that exactly — any drift means
 * `S_ClientJwtBodyHashMismatch` server-side.
 */
export const sha256Base64 = (input: string): string => {

    return crypto.createHash("sha256").update(input, "utf8").digest("base64");
};

/**
 * Build the client-auth JWT claim set without signing it. Useful for BYO
 * signers that need the claim object as input.
 */
export const buildEstablishClientJwtClaims = (
    applicationAnchor: string,
    rawBody: string,
    options: BuildEstablishClientJwtClaimsOptions = {},
): EstablishClientJwtClaims => {

    const lifetimeSeconds = options.lifetimeSeconds ?? CLIENT_JWT_DEFAULT_LIFETIME_SECONDS;

    if (lifetimeSeconds <= 0 || lifetimeSeconds > CLIENT_JWT_MAX_LIFETIME_SECONDS) {

        throw new ConnectConfigError(
            `clientAuth.lifetimeSeconds must be in (0, ${CLIENT_JWT_MAX_LIFETIME_SECONDS}]; got ${lifetimeSeconds}`,
        );
    }

    const now = options.now ?? new Date();
    const iat = Math.floor(now.getTime() / 1000);
    const exp = iat + lifetimeSeconds;
    const jti = (options.jtiGenerator ?? crypto.randomUUID)();

    return {
        iss: applicationAnchor,
        aud: CLIENT_JWT_AUDIENCE,
        iat,
        exp,
        jti,
        body_sha256: sha256Base64(rawBody),
    };
};

/**
 * Sign a client-auth JWT using a PEM-encoded RS256 private key. Returns the
 * compact JWT string; caller is responsible for prefixing it with the
 * `SudomimusClientJWT ` scheme in the `Authorization` header.
 *
 * All claims (`iss`, `aud`, `iat`, `exp`, `jti`, `body_sha256`) are emitted
 * in the JWT body (payload), not the header. This matches the server's
 * `verifyEstablishClientJwt` reader which inspects `parsed.body`. Note that
 * `@sudoo/jwt`'s `issuer`/`audience`/`issuedAt`/`expirationAt`/`identifier`
 * verbal options would route into `parsed.header` instead — so we set the
 * body fields directly and leave the verbal options unused.
 */
export const signEstablishClientJwt = (
    config: ConnectClientAuthWithKey,
    rawBody: string,
): string => {

    const claims = buildEstablishClientJwtClaims(config.applicationAnchor, rawBody, {
        lifetimeSeconds: config.lifetimeSeconds,
        jtiGenerator: config.jtiGenerator,
    });

    const creator: JWTCreator<Record<string, never>, EstablishClientJwtClaims> =
        JWTCreator.instantiate(config.privateKeyPem);

    return creator.create({
        header: {},
        body: claims,
    });
};
