/**
 * @author Sudomimus Contributors
 * @package Connect
 * @namespace Client
 * @description Connect HTTP client
 */

import { TokenVerifier, type AccessToken, type RefreshToken } from "@sudomimus/token";
import { signEstablishClientJwt } from "./client-auth.js";
import { CLIENT_JWT_AUTH_SCHEME, DEFAULT_PUBLIC_KEY_LOCALE, PRODUCTION_BASE_URL } from "./constants.js";
import type {
    ConnectClientAuthConfig,
    ConnectClientOptions,
    ConnectErrorBody,
    EstablishRequest,
    EstablishResponse,
    GetApplicationPublicKeyOptions,
    HealthResponse,
    InfoRequest,
    InfoResponse,
    RedeemRequest,
    RedeemResponse,
    StatusPollRequest,
    StatusPollResponse,
} from "./declare.js";
import { ConnectApiError, ConnectConfigError } from "./error.js";

export class ConnectClient {

    private readonly _baseUrl: string;
    private readonly _fetch: typeof globalThis.fetch;
    private readonly _publicKeyLocale: string;
    private readonly _publicKeyCache: Map<string, string>;
    private readonly _tokenVerifier: TokenVerifier;
    private readonly _clientAuth: ConnectClientAuthConfig | undefined;

    public constructor(options: ConnectClientOptions = {}) {

        this._baseUrl = (options.baseUrl ?? PRODUCTION_BASE_URL).replace(/\/+$/, "");
        // Bind to `globalThis` on store. Some runtimes (e.g. Cloudflare
        // Workers) throw "Illegal invocation" when `fetch` is called with a
        // `this` other than `globalThis`, and we invoke it as `this._fetch(...)`
        // below — which would otherwise drop the binding. Binding here keeps
        // callers from having to pass a pre-bound `fetch`.
        this._fetch = (options.fetch ?? globalThis.fetch).bind(globalThis);
        this._publicKeyLocale = options.publicKeyFetchLocale ?? DEFAULT_PUBLIC_KEY_LOCALE;
        this._publicKeyCache = new Map();
        this._tokenVerifier = new TokenVerifier({
            resolver: (anchor) => this.getApplicationPublicKey(anchor),
        });
        this._clientAuth = options.clientAuth;
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

    public async establish(request: EstablishRequest): Promise<EstablishResponse> {

        return this._postWithClientAuth<EstablishResponse>("establish", "/establish", request);
    }

    public async statusPoll(request: StatusPollRequest): Promise<StatusPollResponse> {

        return this._post<StatusPollRequest, StatusPollResponse>("/status-poll", request);
    }

    public async redeem(request: RedeemRequest): Promise<RedeemResponse> {

        return this._post<RedeemRequest, RedeemResponse>("/redeem", request);
    }

    public async info(request: InfoRequest): Promise<InfoResponse> {

        return this._post<InfoRequest, InfoResponse>("/info", request);
    }

    public async getApplicationPublicKey(
        applicationAnchor: string,
        options: GetApplicationPublicKeyOptions = {},
    ): Promise<string> {

        if (!options.force) {

            const cached: string | undefined = this._publicKeyCache.get(applicationAnchor);

            if (typeof cached === "string") {

                return cached;
            }
        }

        const response: InfoResponse = await this.info({
            applicationAnchor,
            locale: this._publicKeyLocale,
        });
        this._publicKeyCache.set(applicationAnchor, response.applicationPublicKey);
        return response.applicationPublicKey;
    }

    public clearPublicKeyCache(applicationAnchor?: string): void {

        if (typeof applicationAnchor === "string") {

            this._publicKeyCache.delete(applicationAnchor);
            return;
        }

        this._publicKeyCache.clear();
    }

    public async verifyAccessToken(jwt: string): Promise<AccessToken> {

        return this._tokenVerifier.verifyAccessToken(jwt);
    }

    public async verifyRefreshToken(jwt: string): Promise<RefreshToken> {

        return this._tokenVerifier.verifyRefreshToken(jwt);
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

    private async _postWithClientAuth<TRes>(
        methodName: string,
        path: string,
        request: unknown,
    ): Promise<TRes> {

        if (this._clientAuth === undefined) {

            throw new ConnectConfigError(
                `ConnectClient.${methodName}() requires a clientAuth config. Pass clientAuth in the ConnectClientOptions.`,
            );
        }

        // Serialize once. The exact bytes here are what the server hashes
        // against the JWT's body_sha256 claim — letting fetch re-serialize
        // (or going through _post) risks drift on key ordering or whitespace.
        const rawBody: string = JSON.stringify(request);

        const jwt: string = "signer" in this._clientAuth
            ? await this._clientAuth.signer(rawBody)
            : signEstablishClientJwt(this._clientAuth, rawBody);

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

        const errorBody: ConnectErrorBody | undefined = await this._tryReadErrorBody(response);
        throw new ConnectApiError(
            response.status,
            errorBody?.reason,
            errorBody,
        );
    }

    private async _tryReadErrorBody(response: Response): Promise<ConnectErrorBody | undefined> {

        const text: string = await response.text();

        if (text.length === 0) {

            return undefined;
        }

        try {

            return JSON.parse(text) as ConnectErrorBody;
        } catch {

            return undefined;
        }
    }
}
