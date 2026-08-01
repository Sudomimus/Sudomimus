/**
 * @author Sudomimus Contributors
 * @package Session
 * @namespace Error
 * @description Session SDK errors
 */

import type { SessionApiErrorBody } from "./declare.js";

export class SessionApiError extends Error {

    public readonly status: number;
    public readonly reason?: string;
    public readonly body?: SessionApiErrorBody;

    public constructor(status: number, reason?: string, body?: SessionApiErrorBody) {

        super(`Sudomimus Session API error: HTTP ${status}${reason ? ` (${reason})` : ""}`);
        this.name = "SessionApiError";
        this.status = status;
        this.reason = reason;
        this.body = body;
    }
}

export class SessionConfigError extends Error {

    public constructor(message: string) {

        super(message);
        this.name = "SessionConfigError";
    }
}
