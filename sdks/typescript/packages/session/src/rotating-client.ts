/**
 * @author Sudomimus Contributors
 * @package Session
 * @namespace RotatingClient
 * @description Refresh-token rotation wrapper around SessionClient
 */

import type { SessionClient } from "./client.js";
import { SessionConfigError } from "./error.js";
import type { TokenPair, TokenStore } from "./token-store.js";

export class RotatingSessionClient {

    private readonly _client: SessionClient;
    private readonly _store: TokenStore;
    private _inFlightRefresh: Promise<string> | null;

    public constructor(client: SessionClient, store: TokenStore) {

        this._client = client;
        this._store = store;
        this._inFlightRefresh = null;
    }

    public get client(): SessionClient {

        return this._client;
    }

    public get store(): TokenStore {

        return this._store;
    }

    public async seed(tokens: TokenPair): Promise<void> {

        await this._store.save({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
        });
    }

    public async getAccessToken(): Promise<string | null> {

        const pair = await this._store.load();

        if (pair === null) {

            return null;
        }
        return pair.accessToken;
    }

    public async getTokens(): Promise<TokenPair | null> {

        return this._store.load();
    }

    public async refresh(): Promise<string> {

        if (this._inFlightRefresh !== null) {

            return this._inFlightRefresh;
        }

        this._inFlightRefresh = this._performRefresh()
            .finally(() => {

                this._inFlightRefresh = null;
            });
        return this._inFlightRefresh;
    }

    public async logout(): Promise<void> {

        const pair = await this._store.load();

        if (pair === null) {

            return;
        }

        try {

            await this._client.logout({
                refreshToken: pair.refreshToken,
            });
        } finally {

            await this._store.clear();
        }
    }

    private async _performRefresh(): Promise<string> {

        const pair = await this._store.load();

        if (pair === null) {

            throw new SessionConfigError(
                "RotatingSessionClient.refresh() called before seed() — no token pair to rotate.",
            );
        }

        const response = await this._client.refresh({
            refreshToken: pair.refreshToken,
        });

        await this._store.save({
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
        });
        return response.accessToken;
    }
}
