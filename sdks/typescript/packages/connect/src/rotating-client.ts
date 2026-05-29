/**
 * @author Sudomimus Contributors
 * @package Connect
 * @namespace RotatingClient
 * @description Refresh-token rotation wrapper around ConnectClient
 */

import type { ConnectClient } from "./client";
import { ConnectConfigError } from "./error";
import type { TokenPair, TokenStore } from "./token-store";

/**
 * Wraps a {@link ConnectClient} together with a {@link TokenStore} to
 * handle OAuth 2.1 BCP §4.14.2 strict refresh-token rotation correctly:
 *
 *   - {@link refresh} reads the current refresh token from the store,
 *     calls `/refresh`, and atomically writes the rotated pair back
 *     before returning. The caller never sees an intermediate state
 *     where the old refresh token has been consumed but the new one is
 *     not yet persisted.
 *
 *   - Concurrent {@link refresh} calls on the SAME wrapper instance
 *     coalesce onto a single in-flight `/refresh` (in-process
 *     de-dupe). This avoids tripping `RefreshTokenRotationRaceLost` when
 *     many requests fire at once and the access token has just expired.
 *     Cross-PROCESS races are still the caller's responsibility — back
 *     the {@link TokenStore} with an external lock (Redis, DB row lock,
 *     …) if you run multiple instances.
 *
 *   - {@link logout} best-effort revokes the session server-side and
 *     clears the local store, in that order.
 *
 * Initial population of the store happens via {@link seed} — call it
 * with the `{ accessToken, refreshToken }` pair returned by `/redeem`.
 */
export class RotatingConnectClient {

    private readonly _client: ConnectClient;
    private readonly _store: TokenStore;
    private _inFlightRefresh: Promise<string> | null;

    public constructor(client: ConnectClient, store: TokenStore) {

        this._client = client;
        this._store = store;
        this._inFlightRefresh = null;
    }

    /**
     * The underlying low-level client. Exposed for callers that need to
     * drive non-rotation endpoints (`/establish`, `/redeem`, `/info`,
     * `/introspect`, `/revoke-all`, `/health`) without re-wiring.
     */
    public get client(): ConnectClient {

        return this._client;
    }

    /**
     * The token store this wrapper owns. Mostly for introspection in
     * tests.
     */
    public get store(): TokenStore {

        return this._store;
    }

    /**
     * Persist the initial pair returned by `/redeem`. Call this once,
     * right after a successful redeem, before any other method on this
     * wrapper.
     */
    public async seed(tokens: TokenPair): Promise<void> {

        await this._store.save({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
        });
    }

    /**
     * Read the currently-persisted access token. Returns `null` when no
     * session is loaded (no {@link seed} yet, or {@link logout} cleared
     * it). Does NOT auto-refresh — the caller decides when to rotate
     * (typically on a 401 from the upstream API, or when about to make a
     * long-running call).
     */
    public async getAccessToken(): Promise<string | null> {

        const pair = await this._store.load();

        if (pair === null) {

            return null;
        }
        return pair.accessToken;
    }

    /**
     * Read the currently-persisted token pair. Returns `null` when no
     * session is loaded.
     */
    public async getTokens(): Promise<TokenPair | null> {

        return this._store.load();
    }

    /**
     * Rotate the refresh token. Reads the current pair from the store,
     * calls `/refresh`, persists the new pair, and returns the new
     * access token.
     *
     * Throws {@link ConnectConfigError} if the store is empty. Surfaces
     * the underlying `ConnectApiError` (with reasons like
     * `RefreshTokenFamilyCompromised` / `RefreshTokenRotationRaceLost`)
     * on rotation failure — in those cases the family is server-side
     * revoked and the caller MUST re-authenticate via `/establish`.
     *
     * Concurrent calls on the same instance share one in-flight refresh.
     */
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

    /**
     * Best-effort revoke the session on the server (`/logout`) and
     * clear the local store. Idempotent: if the store is empty this is
     * a no-op. If the server-side revoke fails, the local store is
     * still cleared.
     */
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

            throw new ConnectConfigError(
                "RotatingConnectClient.refresh() called before seed() — no token pair to rotate.",
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
