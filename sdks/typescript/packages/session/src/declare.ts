/**
 * @author Sudomimus Contributors
 * @package Session
 * @namespace Declare
 * @description Session schema-derived type aliases
 */

import type { components, paths } from "./_generated/schema.js";

export type SessionSchemas = components["schemas"];
export type SessionPaths = paths;

export type HealthResponse = components["schemas"]["HealthResponse"];
export type RefreshRequest = components["schemas"]["RefreshRequest"];
export type RefreshResponse = components["schemas"]["RefreshResponse"];
export type IntrospectRequest = components["schemas"]["IntrospectRequest"];
export type IntrospectResponse = components["schemas"]["IntrospectResponse"];
export type LogoutRequest = components["schemas"]["LogoutRequest"];
export type LogoutResponse = components["schemas"]["LogoutResponse"];
export type RevokeAllRequest = components["schemas"]["RevokeAllRequest"];
export type RevokeAllResponse = components["schemas"]["RevokeAllResponse"];
export type ClaimsStateView = components["schemas"]["ClaimsStateView"];
export type ClaimRequirementStateView = components["schemas"]["ClaimRequirementStateView"];
export type SessionErrorBody = components["schemas"]["Error"];

export const INTROSPECT_STATUS = {
    ACTIVE: "active",
    REVOKED: "revoked",
    EXPIRED: "expired",
    NOT_FOUND: "not_found",
} as const;
export type IntrospectStatus = IntrospectResponse["status"];

export type SessionClientAuthSigner = (rawBody: string) => Promise<string>;

export type SessionClientAuthWithKey = {

    /** Application anchor — embedded as the JWT `iss` claim. */
    readonly applicationAnchor: string;

    /** PEM-encoded RS256 private key paired with the application's registered client-auth public key. */
    readonly privateKeyPem: string;

    /**
     * JWT lifetime in seconds (`exp - iat`). Defaults to
     * {@link CLIENT_JWT_DEFAULT_LIFETIME_SECONDS}. The server rejects
     * lifetimes above {@link CLIENT_JWT_MAX_LIFETIME_SECONDS}.
     */
    readonly lifetimeSeconds?: number;

    /**
     * Override the JWT `jti` generator. Defaults to `crypto.randomUUID()`.
     * Each call MUST produce a fresh value — the server enforces single-use
     * replay protection.
     */
    readonly jtiGenerator?: () => string;
};

export type SessionClientAuthWithSigner = {

    readonly applicationAnchor: string;
    readonly signer: SessionClientAuthSigner;
};

export type SessionClientAuthConfig = SessionClientAuthWithKey | SessionClientAuthWithSigner;

export interface SessionClientOptions {
    baseUrl?: string;
    fetch?: typeof globalThis.fetch;
    clientAuth?: SessionClientAuthConfig;
}
