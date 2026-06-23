/**
 * @author Sudomimus Contributors
 * @package Connect
 * @namespace Error
 * @description Connect API error class
 */

import type { ConnectErrorBody } from "./declare.js";

export class ConnectApiError extends Error {

    public readonly status: number;
    public readonly reason?: string;
    public readonly body?: ConnectErrorBody;

    public constructor(
        status: number,
        reason: string | undefined,
        body: ConnectErrorBody | undefined,
    ) {

        super(
            typeof reason === "string"
                ? `Connect API error ${status}: ${reason}`
                : `Connect API error ${status}`,
        );
        this.name = "ConnectApiError";
        this.status = status;
        this.reason = reason;
        this.body = body;
    }
}

export class ConnectConfigError extends Error {

    public constructor(message: string) {

        super(message);
        this.name = "ConnectConfigError";
    }
}
