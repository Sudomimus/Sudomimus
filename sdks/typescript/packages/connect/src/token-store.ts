/**
 * @author Sudomimus Contributors
 * @package Connect
 * @namespace TokenStore
 * @description Token-store interface and in-memory default
 */

/**
 * A pair of Connect-issued tokens. The shape matches what `/redeem` and
 * `/refresh` return — store both verbatim so the next rotation can
 * present the current refresh token.
 */
export interface TokenPair {

    readonly accessToken: string;

    readonly refreshToken: string;
}

/**
 * Persistence contract for a single Sudomimus session's token pair.
 *
 * The Connect API does OAuth 2.1 BCP §4.14.2 strict refresh-token
 * rotation: every `/refresh` returns a NEW refresh token and invalidates
 * the one that was presented. Re-presenting the old refresh token (or
 * losing the rotation race to a concurrent caller) is treated as
 * compromise and revokes the entire refresh-token family.
 *
 * Implementations MUST therefore:
 *
 *   1. Return the most recently written pair from {@link load}.
 *   2. Atomically replace the stored pair on {@link save} — partial
 *      writes that leave only the new access token without the new
 *      refresh token will desynchronize the caller from the server.
 *   3. Be safe to call from multiple concurrent code paths within a
 *      single process. Cross-process serialization (e.g. Redis lock
 *      around `load → /refresh → save`) is the caller's responsibility.
 *
 * One store instance represents ONE session — typically one logged-in
 * user on one device. For backends that serve many users, instantiate
 * one store per session and back it with whatever per-session storage
 * already exists (database row, Redis hash, cookie-jar, …).
 */
export interface TokenStore {

    /**
     * Read the current pair. Returns `null` when no session has been
     * established yet (or after {@link clear}).
     */
    load(): Promise<TokenPair | null>;

    /**
     * Atomically overwrite the stored pair. Called after the initial
     * `/redeem` and after every successful `/refresh`.
     */
    save(tokens: TokenPair): Promise<void>;

    /**
     * Forget the pair (e.g. on `/logout` or family compromise).
     */
    clear(): Promise<void>;
}

/**
 * In-memory single-session token store.
 *
 * Suitable for development, tests, and short-lived processes. NOT
 * suitable for a multi-process server — each process holds an independent
 * copy and a refresh-token rotation in one process will not be visible to
 * the others (which will then race and trip family compromise).
 */
export class InMemoryTokenStore implements TokenStore {

    private _pair: TokenPair | null;

    public constructor(initial?: TokenPair) {

        this._pair = initial ?? null;
    }

    public async load(): Promise<TokenPair | null> {

        return this._pair;
    }

    public async save(tokens: TokenPair): Promise<void> {

        this._pair = { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
    }

    public async clear(): Promise<void> {

        this._pair = null;
    }
}
