/**
 * @author Sudomimus Contributors
 * @package Native
 * @namespace Client
 * @description Native HTTP client
 */

import type { NativeClientOptions } from "./declare";

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
