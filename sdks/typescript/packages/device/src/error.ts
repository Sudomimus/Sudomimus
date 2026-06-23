/**
 * @author Sudomimus Contributors
 * @package Device
 * @namespace Error
 * @description Device SDK errors
 */

import type { DeviceAuthorizeResponse, DeviceErrorBody, DeviceTokenErrorBody } from "./declare.js";

export class DeviceApiError extends Error {

    public readonly status: number;
    public readonly reason: string | undefined;
    public readonly body: DeviceErrorBody | undefined;

    public constructor(status: number, reason?: string, body?: DeviceErrorBody) {

        super(`Device API error ${status}${reason ? `: ${reason}` : ""}`);
        this.name = "DeviceApiError";
        this.status = status;
        this.reason = reason;
        this.body = body;
    }
}

export class DeviceTokenApiError extends Error {

    public readonly status: number;
    public readonly error: string;
    public readonly interval: number | undefined;
    public readonly body: DeviceTokenErrorBody;

    public constructor(status: number, body: DeviceTokenErrorBody) {

        super(`Device token error ${status}: ${body.error}`);
        this.name = "DeviceTokenApiError";
        this.status = status;
        this.error = body.error;
        this.interval = body.interval;
        this.body = body;
    }
}

export class DevicePollTimeoutError extends Error {

    public readonly authorization: DeviceAuthorizeResponse;

    public constructor(authorization: DeviceAuthorizeResponse) {

        super("Device authorization polling timed out before tokens were issued.");
        this.name = "DevicePollTimeoutError";
        this.authorization = authorization;
    }
}
