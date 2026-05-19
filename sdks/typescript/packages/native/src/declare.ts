/**
 * @author Sudomimus Contributors
 * @package Native
 * @namespace Declare
 * @description Native schema-derived type aliases
 */

import type { components, paths } from "./_generated/schema";

export type NativeSchemas = components["schemas"];
export type NativePaths = paths;

export type StatusPollRequest = components["schemas"]["StatusPollRequest"];
export type StatusPollResponse = components["schemas"]["StatusPollResponse"];
export type NativeError = components["schemas"]["Error"];

export interface NativeClientOptions {
    baseUrl: string;
    fetch?: typeof globalThis.fetch;
}
