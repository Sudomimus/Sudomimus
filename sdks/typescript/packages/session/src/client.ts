/**
 * @author Sudomimus Contributors
 * @package Session
 * @namespace Client
 * @description Session HTTP client
 */

import { signSessionClientJwt } from "./client-auth.js";
import {
    TokenError,
    TokenVerifier,
    rsaJwkToPem,
    type AccessToken,
    type RefreshToken,
} from "@sudomimus/token";
import {
    CLIENT_JWT_AUTH_SCHEME,
    DEFAULT_JWKS_CACHE_SECONDS,
    PRODUCTION_BASE_URL,
} from "./constants.js";
import type {
    ApplicationJsonWebKey,
    ApplicationJwksOptions,
    ApplicationJwksResponse,
    ClaimStateResponse,
    HealthResponse,
    IntrospectRequest,
    IntrospectResponse,
    LogoutRequest,
    LogoutResponse,
    RefreshRequest,
    RefreshResponse,
    RevokeAllRequest,
    RevokeAllResponse,
    SessionClientAuthConfig,
    SessionClientOptions,
    SessionApiErrorBody,
    UserInfoResponse,
} from "./declare.js";
import { SessionApiError, SessionConfigError } from "./error.js";

export class SessionClient {

    private readonly _baseUrl: string;
    private readonly _fetch: typeof globalThis.fetch;
    private readonly _clientAuth: SessionClientAuthConfig | undefined;
    private readonly _jwksCache: Map<string, { expiresAt: number; value: ApplicationJwksResponse }>;
    private readonly _tokenVerifier: TokenVerifier;

    public constructor(options: SessionClientOptions = {}) {

        this._baseUrl = (options.baseUrl ?? PRODUCTION_BASE_URL).replace(/\/+$/, "");
        this._fetch = (options.fetch ?? globalThis.fetch).bind(globalThis);
        this._clientAuth = options.clientAuth;
        this._jwksCache = new Map();
        this._tokenVerifier = new TokenVerifier({
            resolver: (anchor, keyId) => this.resolveApplicationPublicKey(anchor, keyId),
        });
    }

    public get baseUrl(): string {

        return this._baseUrl;
    }

    public get fetch(): typeof globalThis.fetch {

        return this._fetch;
    }

    public async health(): Promise<HealthResponse> {

        return this._get<HealthResponse>("/health");
    }

    public async applicationJwks(
        applicationAnchor: string,
        options: ApplicationJwksOptions = {},
    ): Promise<ApplicationJwksResponse> {

        const cached = this._jwksCache.get(applicationAnchor);

        if (!options.force && cached !== undefined && cached.expiresAt > Date.now()) {

            return cached.value;
        }

        const encodedAnchor = encodeURIComponent(applicationAnchor);
        const response = await this._fetch(
            `${this._baseUrl}/applications/${encodedAnchor}/jwks.json`,
            { method: "GET", headers: { "Accept": "application/json" } },
        );
        const value = await this._handle<ApplicationJwksResponse>(response);
        const maxAge = this._cacheMaxAgeSeconds(response.headers?.get("Cache-Control"));
        this._jwksCache.set(applicationAnchor, {
            expiresAt: Date.now() + maxAge * 1000,
            value,
        });
        return value;
    }

    public clearJwksCache(applicationAnchor?: string): void {

        if (applicationAnchor === undefined) {

            this._jwksCache.clear();
            return;
        }
        this._jwksCache.delete(applicationAnchor);
    }

    public async resolveApplicationPublicKey(
        applicationAnchor: string,
        keyId: string,
    ): Promise<string> {

        let jwks = await this.applicationJwks(applicationAnchor);
        let key: ApplicationJsonWebKey | undefined = jwks.keys.find((candidate) => candidate.kid === keyId);

        if (key === undefined) {

            jwks = await this.applicationJwks(applicationAnchor, { force: true });
            key = jwks.keys.find((candidate) => candidate.kid === keyId);
        }

        if (key === undefined) {

            throw new TokenError("UNKNOWN_KEY_ID", `No application signing key matches kid "${keyId}".`);
        }
        return rsaJwkToPem(key);
    }

    public verifyAccessToken(jwt: string): Promise<AccessToken> {

        return this._tokenVerifier.verifyAccessToken(jwt);
    }

    public verifyRefreshToken(jwt: string): Promise<RefreshToken> {

        return this._tokenVerifier.verifyRefreshToken(jwt);
    }

    public async refresh(request: RefreshRequest): Promise<RefreshResponse> {

        return this._post<RefreshRequest, RefreshResponse>("/refresh", request);
    }

    public async introspect(request: IntrospectRequest): Promise<IntrospectResponse> {

        return this._post<IntrospectRequest, IntrospectResponse>("/introspect", request);
    }

    public async userinfo(accessToken: string): Promise<UserInfoResponse> {

        return this._getWithBearer<UserInfoResponse>("/userinfo", accessToken);
    }

    public async claimState(accessToken: string): Promise<ClaimStateResponse> {

        return this._getWithBearer<ClaimStateResponse>("/claim-state", accessToken);
    }

    public async logout(request: LogoutRequest): Promise<LogoutResponse> {

        return this._post<LogoutRequest, LogoutResponse>("/logout", request);
    }

    public async revokeAll(request: RevokeAllRequest): Promise<RevokeAllResponse> {

        return this._postWithClientAuth<RevokeAllResponse>("revokeAll", "/revoke-all", request);
    }

    private async _get<TRes>(path: string): Promise<TRes> {

        const response: Response = await this._fetch(`${this._baseUrl}${path}`, {
            method: "GET",
            headers: {
                "Accept": "application/json",
            },
        });
        return this._handle<TRes>(response);
    }

    private async _post<TReq, TRes>(
        path: string,
        body: TReq,
    ): Promise<TRes> {

        const response: Response = await this._fetch(`${this._baseUrl}${path}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            body: JSON.stringify(body),
        });
        return this._handle<TRes>(response);
    }

    private async _getWithBearer<TRes>(
        path: string,
        accessToken: string,
    ): Promise<TRes> {

        const response: Response = await this._fetch(`${this._baseUrl}${path}`, {
            method: "GET",
            headers: {
                "Accept": "application/json",
                "Authorization": `Bearer ${accessToken}`,
            },
        });
        return this._handle<TRes>(response);
    }

    private async _postWithClientAuth<TRes>(
        methodName: string,
        path: string,
        request: unknown,
    ): Promise<TRes> {

        if (this._clientAuth === undefined) {

            throw new SessionConfigError(
                `SessionClient.${methodName}() requires a clientAuth config. Pass clientAuth in the SessionClientOptions.`,
            );
        }

        const rawBody: string = JSON.stringify(request);

        const jwt: string = "signer" in this._clientAuth
            ? await this._clientAuth.signer(rawBody)
            : signSessionClientJwt(this._clientAuth, rawBody);

        const response: Response = await this._fetch(`${this._baseUrl}${path}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": `${CLIENT_JWT_AUTH_SCHEME} ${jwt}`,
            },
            body: rawBody,
        });
        return this._handle<TRes>(response);
    }

    private async _handle<TRes>(response: Response): Promise<TRes> {

        if (response.ok) {

            return await response.json() as TRes;
        }

        const errorBody: SessionApiErrorBody | undefined = await this._tryReadErrorBody(response);
        throw new SessionApiError(
            response.status,
            errorBody !== undefined && "reason" in errorBody ? errorBody.reason : undefined,
            errorBody,
        );
    }

    private async _tryReadErrorBody(response: Response): Promise<SessionApiErrorBody | undefined> {

        const text: string = await response.text();

        if (text.length === 0) {

            return undefined;
        }

        try {

            return JSON.parse(text) as SessionApiErrorBody;
        } catch {

            return undefined;
        }
    }

    private _cacheMaxAgeSeconds(cacheControl: string | null | undefined): number {

        const match = cacheControl?.match(/(?:^|,)\s*max-age=(\d+)\s*(?:,|$)/i);
        return match?.[1] === undefined
            ? DEFAULT_JWKS_CACHE_SECONDS
            : Number.parseInt(match[1], 10);
    }
}
