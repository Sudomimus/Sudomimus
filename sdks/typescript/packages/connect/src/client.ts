/**
 * @author Sudomimus Contributors
 * @package Connect
 * @namespace Client
 * @description Connect HTTP client
 */

import { TokenVerifier, type AccessToken, type RefreshToken } from "@sudomimus/token";
import { DEFAULT_PUBLIC_KEY_LOCALE } from "./constants";
import type {
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
    RefreshRequest,
    RefreshResponse,
    StatusPollRequest,
    StatusPollResponse,
} from "./declare";
import { ConnectApiError } from "./error";

export class ConnectClient {

    private readonly _baseUrl: string;
    private readonly _fetch: typeof globalThis.fetch;
    private readonly _publicKeyLocale: string;
    private readonly _publicKeyCache: Map<string, string>;
    private readonly _tokenVerifier: TokenVerifier;

    public constructor(options: ConnectClientOptions) {

        this._baseUrl = options.baseUrl.replace(/\/+$/, "");
        this._fetch = options.fetch ?? globalThis.fetch;
        this._publicKeyLocale = options.publicKeyFetchLocale ?? DEFAULT_PUBLIC_KEY_LOCALE;
        this._publicKeyCache = new Map();
        this._tokenVerifier = new TokenVerifier({
            resolver: (anchor) => this.getApplicationPublicKey(anchor),
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

    public async establish(request: EstablishRequest): Promise<EstablishResponse> {

        return this._post<EstablishRequest, EstablishResponse>("/establish", request);
    }

    public async statusPoll(request: StatusPollRequest): Promise<StatusPollResponse> {

        return this._post<StatusPollRequest, StatusPollResponse>("/status-poll", request);
    }

    public async redeem(request: RedeemRequest): Promise<RedeemResponse> {

        return this._post<RedeemRequest, RedeemResponse>("/redeem", request);
    }

    public async refresh(request: RefreshRequest): Promise<RefreshResponse> {

        return this._post<RefreshRequest, RefreshResponse>("/refresh", request);
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
