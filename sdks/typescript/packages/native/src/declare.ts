/**
 * @author Sudomimus Contributors
 * @package Native
 * @namespace Declare
 * @description Native schema-derived type aliases
 */

import type { components, paths } from "./_generated/schema.js";

export type NativeSchemas = components["schemas"];
export type NativePaths = paths;

export type DirectIssueSteamTicketRequest = components["schemas"]["DirectIssueSteamTicketRequest"];
export type DirectIssueSteamTicketResponse = components["schemas"]["DirectIssueSteamTicketResponse"];
export type DirectIssueAccessKeyRequest = components["schemas"]["DirectIssueAccessKeyRequest"];
export type DirectIssueAccessKeyResponse = components["schemas"]["DirectIssueAccessKeyResponse"];
export type DirectIssuePublicKeyRequest = components["schemas"]["DirectIssuePublicKeyRequest"];
export type DirectIssuePublicKeyResponse = DirectIssueAccessKeyResponse;
export type ClaimsStateView = components["schemas"]["ClaimsStateView"];
export type ClaimRequirementStateView = components["schemas"]["ClaimRequirementStateView"];
export type ErrandHandoff = components["schemas"]["ErrandHandoff"];
export type ErrandStatusResponse = components["schemas"]["ErrandStatusResponse"];
export type DirectIssueDeniedError = components["schemas"]["DirectIssueDeniedError"];
export type DirectIssueSteamTicketConflictError = components["schemas"]["DirectIssueSteamTicketConflictError"];
export type SteamAgreementAcceptance = NonNullable<DirectIssueSteamTicketRequest["agreementAcceptance"]>;
export type NativeLegalAgreementChallenge = components["schemas"]["NativeLegalAgreementChallenge"];
export type NativeLegalAgreementDocument = components["schemas"]["NativeLegalAgreementDocumentV1"];
export type NativeLegalAgreementLocale = components["schemas"]["NativeLegalAgreementLocale"];
export type CreateErrandRequest = components["schemas"]["CreateErrandRequest"];
export type CreateErrandResponse = components["schemas"]["CreateErrandResponse"];

/**
 * Claim-gate refusals carry claims and an errand. Basic terms errors carry
 * the Steam agreement, a browser terms URL, or the current required revision.
 */
export type NativeErrorBody = components["schemas"]["DirectIssueDeniedError"];

export interface NativeClientOptions {
    baseUrl?: string;
    fetch?: typeof globalThis.fetch;
}

/** Registered Ed25519 credential used by public-key direct issue. */
export interface PublicKeyCredential {
    /** Registered public-key identifier (`pky_...`). */
    keyId: string;
    /** Sign the supplied JOSE signing input and return a raw 64-byte Ed25519 signature. */
    sign: (signingInput: Uint8Array) => Uint8Array | Promise<Uint8Array>;
}

/**
 * The Steam ticket identity string the client SDK MUST pass to
 * `ISteamUser::GetAuthTicketForWebApi(identity)`. Steam binds the issued
 * ticket to this identity; the Native API's server-side verifier hardcodes
 * the same value, so tickets generated with any other identity will be
 * rejected.
 */
export const STEAM_TICKET_IDENTITY = "sudomimus";
