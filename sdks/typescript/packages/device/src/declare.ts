/**
 * @author Sudomimus Contributors
 * @package Device
 * @namespace Declare
 * @description Device schema-derived type aliases
 */

import type { components, paths } from "./_generated/schema";

export type DeviceSchemas = components["schemas"];
export type DevicePaths = paths;

export type HealthResponse = components["schemas"]["HealthResponse"];
export type DeviceAuthorizeRequest = components["schemas"]["DeviceAuthorizeRequest"];
export type DeviceAuthorizeResponse = components["schemas"]["DeviceAuthorizeResponse"];
export type DeviceTokenRequest = components["schemas"]["DeviceTokenRequest"];
export type DeviceTokenResponse = components["schemas"]["DeviceTokenResponse"];
export type DeviceTokenErrorBody = components["schemas"]["DeviceTokenError"];
export type ClaimsStateView = components["schemas"]["ClaimsStateView"];
export type ClaimRequirementStateView = components["schemas"]["ClaimRequirementStateView"];

/**
 * Generic non-polling error body. `/device-token` polling states use
 * {@link DeviceTokenErrorBody} instead.
 */
export type DeviceErrorBody = components["schemas"]["Error"];

export interface DeviceClientOptions {
    baseUrl: string;
    fetch?: typeof globalThis.fetch;
}
