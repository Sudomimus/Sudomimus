/**
 * @author WMXPY
 * @package Native
 * @namespace Root
 * @description Error
 */

import type { NativeErrorBody } from "./declare.js";

export class NativeApiError extends Error {

    public readonly status: number;
    public readonly reason?: string;
    public readonly body?: NativeErrorBody;

    public constructor(
        status: number,
        reason: string | undefined,
        body: NativeErrorBody | undefined,
    ) {

        super(
            typeof reason === "string"
                ? `Native API error ${status}: ${reason}`
                : `Native API error ${status}`,
        );
        this.name = "NativeApiError";
        this.status = status;
        this.reason = reason;
        this.body = body;
    }
}
