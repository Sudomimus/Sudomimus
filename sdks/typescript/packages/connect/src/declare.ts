/**
 * @author Sudomimus Contributors
 * @package Connect
 * @namespace Declare
 * @description Connect schema-derived type aliases
 */

import type { components, paths } from "./_generated/schema";

export type ConnectSchemas = components["schemas"];
export type ConnectPaths = paths;

export type HealthResponse = components["schemas"]["HealthResponse"];
export type EstablishRequest = components["schemas"]["EstablishRequest"];
export type EstablishResponse = components["schemas"]["EstablishResponse"];
export type StatusPollRequest = components["schemas"]["StatusPollRequest"];
export type StatusPollResponse = components["schemas"]["StatusPollResponse"];
export type StatusPollPendingResponse = components["schemas"]["StatusPollPendingResponse"];
export type StatusPollRealizedResponse = components["schemas"]["StatusPollRealizedResponse"];
export type RedeemRequest = components["schemas"]["RedeemRequest"];
export type RedeemResponse = components["schemas"]["RedeemResponse"];
export type ClaimsStateView = components["schemas"]["ClaimsStateView"];
export type ClaimRequirementStateView = components["schemas"]["ClaimRequirementStateView"];
export type InfoRequest = components["schemas"]["InfoRequest"];
export type InfoResponse = components["schemas"]["InfoResponse"];

export type AuthenticationRuleConstraint = components["schemas"]["AuthenticationRuleConstraint"];
export type AuthenticationRulePasskeyUsernamelessPayload = components["schemas"]["AuthenticationRulePasskeyUsernamelessPayload"];
export type AuthenticationRulePasskeyReasonedPayload = components["schemas"]["AuthenticationRulePasskeyReasonedPayload"];
export type AuthenticationRuleEmailVerificationPayload = components["schemas"]["AuthenticationRuleEmailVerificationPayload"];
export type AuthenticationRuleSteamTicketPayload = components["schemas"]["AuthenticationRuleSteamTicketPayload"];
export type AuthenticationRuleSteamOpenIdPayload = components["schemas"]["AuthenticationRuleSteamOpenIdPayload"];
export type AuthenticationRuleAccessKeyDirectPayload = components["schemas"]["AuthenticationRuleAccessKeyDirectPayload"];
export type AuthenticationRuleGoogleOAuthPayload = components["schemas"]["AuthenticationRuleGoogleOAuthPayload"];
export type AuthenticationRuleGitHubOAuthPayload = components["schemas"]["AuthenticationRuleGitHubOAuthPayload"];
export type AuthenticationRuleDiscordOAuthPayload = components["schemas"]["AuthenticationRuleDiscordOAuthPayload"];
export type AuthenticationRuleBattleNetOAuthPayload = components["schemas"]["AuthenticationRuleBattleNetOAuthPayload"];
export type AuthenticationRuleXOAuthPayload = components["schemas"]["AuthenticationRuleXOAuthPayload"];

export type RealizeRuleConstraint = components["schemas"]["RealizeRuleConstraint"];
export type RealizeRuleEmailPayload = components["schemas"]["RealizeRuleEmailPayload"];
export type RealizeRuleSteamIdPayload = components["schemas"]["RealizeRuleSteamIdPayload"];
export type RealizeRuleAccountAliasPayload = components["schemas"]["RealizeRuleAccountAliasPayload"];
export type RealizeRuleSectorSubjectPayload = components["schemas"]["RealizeRuleSectorSubjectPayload"];

export type ReturnMethodDeclaration = components["schemas"]["ReturnMethodDeclaration"];
export type ReturnMethodCallback = components["schemas"]["ReturnMethodCallback"];
export type ReturnMethodStatusPoll = components["schemas"]["ReturnMethodStatusPoll"];
export type ReturnMethodReveal = components["schemas"]["ReturnMethodReveal"];
export type ReturnMethodDirectIssue = components["schemas"]["ReturnMethodDirectIssue"];
export type ReturnMethodOidc = components["schemas"]["ReturnMethodOidc"];

export type ConnectErrorBody = components["schemas"]["Error"];

/**
 * Runtime-accessible string-literal constants for the new enums. Kept as
 * `as const` objects so consumers can write `AUTHENTICATION_METHOD.PASSKEY_USERNAMELESS`
 * while still narrowing to the union literal types generated from the
 * OpenAPI spec.
 */
export const AUTHENTICATION_METHOD = {
    PASSKEY_USERNAMELESS: "PASSKEY_USERNAMELESS",
    PASSKEY_REASONED: "PASSKEY_REASONED",
    EMAIL_VERIFICATION: "EMAIL_VERIFICATION",
    STEAM_TICKET: "STEAM_TICKET",
    STEAM_OPENID: "STEAM_OPENID",
    ACCESS_KEY_DIRECT: "ACCESS_KEY_DIRECT",
    GOOGLE_OAUTH: "GOOGLE_OAUTH",
    GITHUB_OAUTH: "GITHUB_OAUTH",
    DISCORD_OAUTH: "DISCORD_OAUTH",
    BATTLENET_OAUTH: "BATTLENET_OAUTH",
    X_OAUTH: "X_OAUTH",
} as const;
export type AuthenticationMethod = AuthenticationRuleConstraint["method"];

export const REALIZE_CONSTRAINT_TYPE = {
    EMAIL: "EMAIL",
    STEAM_ID: "STEAM_ID",
    ACCOUNT_ALIAS: "ACCOUNT_ALIAS",
    SECTOR_SUBJECT: "SECTOR_SUBJECT",
} as const;
export type RealizeConstraintType = RealizeRuleConstraint["constraintType"];

export const RETURN_METHOD = {
    CALLBACK: "CALLBACK",
    STATUS_POLL: "STATUS_POLL",
    REVEAL: "REVEAL",
    DIRECT_ISSUE: "DIRECT_ISSUE",
    OIDC: "OIDC",
} as const;
export type ReturnMethod = ReturnMethodDeclaration["type"];

/**
 * Signature for a BYO (bring-your-own) client-auth JWT signer.
 *
 * The signer receives the exact JSON string that will be sent on the wire
 * and MUST return a signed JWT whose `body_sha256` claim is the standard
 * base64 of `SHA-256(rawBody)` over UTF-8 bytes.
 */
export type ConnectClientAuthSigner = (rawBody: string) => Promise<string>;

export type ConnectClientAuthWithKey = {

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

export type ConnectClientAuthWithSigner = {

    readonly applicationAnchor: string;
    readonly signer: ConnectClientAuthSigner;
};

export type ConnectClientAuthConfig = ConnectClientAuthWithKey | ConnectClientAuthWithSigner;

export interface ConnectClientOptions {
    baseUrl?: string;
    fetch?: typeof globalThis.fetch;
    publicKeyFetchLocale?: string;
    clientAuth?: ConnectClientAuthConfig;
}

export interface GetApplicationPublicKeyOptions {
    force?: boolean;
}
