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
export type NativeErrorBody = components["schemas"]["Error"];

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
