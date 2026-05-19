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
export type RefreshRequest = components["schemas"]["RefreshRequest"];
export type RefreshResponse = components["schemas"]["RefreshResponse"];
export type InfoRequest = components["schemas"]["InfoRequest"];
export type InfoResponse = components["schemas"]["InfoResponse"];
export type AuthAction = components["schemas"]["AuthAction"];
export type AuthActionCallback = components["schemas"]["AuthActionCallback"];
export type AuthActionStatusPoll = components["schemas"]["AuthActionStatusPoll"];
export type AuthActionSteam = components["schemas"]["AuthActionSteam"];
export type ConnectErrorBody = components["schemas"]["Error"];

export interface ConnectClientOptions {
    baseUrl: string;
    fetch?: typeof globalThis.fetch;
    publicKeyFetchLocale?: string;
}

export interface GetApplicationPublicKeyOptions {
    force?: boolean;
}
