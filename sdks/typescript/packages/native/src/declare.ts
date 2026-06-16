/**
 * @author Sudomimus Contributors
 * @package Native
 * @namespace Declare
 * @description Native schema-derived type aliases
 */

import type { components, paths } from "./_generated/schema";

export type NativeSchemas = components["schemas"];
export type NativePaths = paths;

export type DirectIssueSteamTicketRequest = components["schemas"]["DirectIssueSteamTicketRequest"];
export type DirectIssueSteamTicketResponse = components["schemas"]["DirectIssueSteamTicketResponse"];
export type DirectIssueAccessKeyRequest = components["schemas"]["DirectIssueAccessKeyRequest"];
export type DirectIssueAccessKeyResponse = components["schemas"]["DirectIssueAccessKeyResponse"];
export type ClaimsStateView = components["schemas"]["ClaimsStateView"];
export type ClaimRequirementStateView = components["schemas"]["ClaimRequirementStateView"];
export type ErrandHandoff = components["schemas"]["ErrandHandoff"];
export type ErrandStatusResponse = components["schemas"]["ErrandStatusResponse"];
export type DirectIssueDeniedError = components["schemas"]["DirectIssueDeniedError"];
export type CreateErrandRequest = components["schemas"]["CreateErrandRequest"];
export type CreateErrandResponse = components["schemas"]["CreateErrandResponse"];

/**
 * Error body for a failed direct-issue. Claim-gate 403s
 * (`ClaimConsentRequired` / `RequiredClaimDataMissing`) additionally carry the
 * `claims` view and the `errand` browser handoff; every other failure carries
 * only `reason`.
 */
export type NativeErrorBody = components["schemas"]["DirectIssueDeniedError"];

export interface NativeClientOptions {
    baseUrl: string;
    fetch?: typeof globalThis.fetch;
}

/**
 * The Steam ticket identity string the client SDK MUST pass to
 * `ISteamUser::GetAuthTicketForWebApi(identity)`. Steam binds the issued
 * ticket to this identity; the Native API's server-side verifier hardcodes
 * the same value, so tickets generated with any other identity will be
 * rejected.
 */
export const STEAM_TICKET_IDENTITY = "sudomimus";
