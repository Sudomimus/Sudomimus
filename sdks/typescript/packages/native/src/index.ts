/**
 * @author Sudomimus Contributors
 * @package Native
 * @namespace Root
 * @description Index
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

export class NativeClient {

    private readonly _baseUrl: string;
    private readonly _fetch: typeof globalThis.fetch;

    public constructor(options: NativeClientOptions) {

        this._baseUrl = options.baseUrl.replace(/\/+$/, "");
        this._fetch = options.fetch ?? globalThis.fetch;
    }

    public get baseUrl(): string {

        return this._baseUrl;
    }

    public get fetch(): typeof globalThis.fetch {

        return this._fetch;
    }
}
