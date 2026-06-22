/**
 * @author Sudomimus Contributors
 * @package Session
 * @namespace ClientAuth
 * @description Client-auth JWT helpers for /revoke-all
 */

import { JWTCreator } from "@sudoo/jwt";
import * as crypto from "crypto";
import {
    CLIENT_JWT_AUDIENCE,
    CLIENT_JWT_DEFAULT_LIFETIME_SECONDS,
    CLIENT_JWT_MAX_LIFETIME_SECONDS,
} from "./constants";
import type { SessionClientAuthWithKey } from "./declare";
import { SessionConfigError } from "./error";

export type SessionClientJwtClaims = {

    readonly iss: string;
    readonly aud: string;
    readonly iat: number;
    readonly exp: number;
    readonly jti: string;
    readonly body_sha256: string;
};

export type BuildSessionClientJwtClaimsOptions = {

    readonly lifetimeSeconds?: number;
    readonly jtiGenerator?: () => string;
    readonly now?: Date;
};

export const sha256Base64 = (input: string): string => {

    return crypto.createHash("sha256").update(input, "utf8").digest("base64");
};

export const buildSessionClientJwtClaims = (
    applicationAnchor: string,
    rawBody: string,
    options: BuildSessionClientJwtClaimsOptions = {},
): SessionClientJwtClaims => {

    const lifetimeSeconds = options.lifetimeSeconds ?? CLIENT_JWT_DEFAULT_LIFETIME_SECONDS;

    if (lifetimeSeconds <= 0 || lifetimeSeconds > CLIENT_JWT_MAX_LIFETIME_SECONDS) {

        throw new SessionConfigError(
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

export const signSessionClientJwt = (
    config: SessionClientAuthWithKey,
    rawBody: string,
): string => {

    const claims = buildSessionClientJwtClaims(config.applicationAnchor, rawBody, {
        lifetimeSeconds: config.lifetimeSeconds,
        jtiGenerator: config.jtiGenerator,
    });

    const creator: JWTCreator<Record<string, never>, SessionClientJwtClaims> =
        JWTCreator.instantiate(config.privateKeyPem);

    return creator.create({
        header: {},
        body: claims,
    });
};
