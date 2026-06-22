/**
 * @author Sudomimus Contributors
 * @package Session
 * @namespace TokenStore
 * @description Token-store interface and in-memory default
 */

/**
 * A pair of Sudomimus application tokens. Initial login flows such as Connect
 * `/redeem`, Device `/device-token`, and Native `/direct-issue/*` return this
 * shape; Session `/refresh` returns the same shape after rotation.
 */
export interface TokenPair {

    readonly accessToken: string;

    readonly refreshToken: string;
}

/**
 * Persistence contract for a single Sudomimus session's token pair.
 *
 * The Session API does OAuth 2.1 BCP §4.14.2 strict refresh-token rotation:
 * every `/refresh` returns a NEW refresh token and invalidates the one that
 * was presented. Implementations must atomically replace the stored pair on
 * every successful save.
 */
export interface TokenStore {

    load(): Promise<TokenPair | null>;

    save(tokens: TokenPair): Promise<void>;

    clear(): Promise<void>;
}

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
