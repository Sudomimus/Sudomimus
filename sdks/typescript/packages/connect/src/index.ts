/**
 * @author Sudomimus Contributors
 * @package Connect
 * @namespace Root
 * @description Index
 */

import type { components, paths } from "./_generated/schema";

export type ConnectSchemas = components["schemas"];
export type ConnectPaths = paths;

export type EstablishRequest = components["schemas"]["EstablishRequest"];
export type EstablishResponse = components["schemas"]["EstablishResponse"];
export type RedeemRequest = components["schemas"]["RedeemRequest"];
export type RefreshRequest = components["schemas"]["RefreshRequest"];
export type TokenPair = components["schemas"]["TokenPair"];
export type ConnectError = components["schemas"]["Error"];

export interface ConnectClientOptions {
    baseUrl: string;
    fetch?: typeof globalThis.fetch;
}

export class ConnectClient {

    private readonly _baseUrl: string;
    private readonly _fetch: typeof globalThis.fetch;

    public constructor(options: ConnectClientOptions) {

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
