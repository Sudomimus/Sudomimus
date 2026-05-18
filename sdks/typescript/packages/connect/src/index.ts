/**
 * @author Sudomimus Contributors
 * @package Connect
 * @namespace Root
 * @description Index
 */

import type { components, paths } from "./_generated/schema";
import {
    ACCESS_TOKEN_KEY_TYPE,
    ConnectTokenError,
    REFRESH_TOKEN_KEY_TYPE,
    parseAccessToken,
    parseRefreshToken,
    type AccessToken,
    type RefreshToken,
} from "./token";

export type ConnectSchemas = components["schemas"];
export type ConnectPaths = paths;

export type HealthResponse = components["schemas"]["HealthResponse"];
export type EstablishRequest = components["schemas"]["EstablishRequest"];
export type EstablishResponse = components["schemas"]["EstablishResponse"];
export type StatusPollRequest = components["schemas"]["StatusPollRequest"];
export type StatusPollResponse = components["schemas"]["StatusPollResponse"];
export type StatusPollPendingResponse = components["schemas"]["StatusPollPendingResponse"];
export type StatusPollRealizedResponse = components["schemas"]["StatusPollRealizedResponse"];
export type RedeemRequest = components["schemas"]["RedeemRequest"];
export type RedeemResponse = components["schemas"]["RedeemResponse"];
export type RefreshRequest = components["schemas"]["RefreshRequest"];
export type RefreshResponse = components["schemas"]["RefreshResponse"];
export type InfoRequest = components["schemas"]["InfoRequest"];
export type InfoResponse = components["schemas"]["InfoResponse"];
export type AuthAction = components["schemas"]["AuthAction"];
export type AuthActionCallback = components["schemas"]["AuthActionCallback"];
export type AuthActionStatusPoll = components["schemas"]["AuthActionStatusPoll"];
export type AuthActionSteam = components["schemas"]["AuthActionSteam"];
export type ConnectErrorBody = components["schemas"]["Error"];

export {
    ACCESS_TOKEN_KEY_TYPE,
    ConnectTokenError,
    REFRESH_TOKEN_KEY_TYPE,
    parseAccessToken,
    parseRefreshToken,
} from "./token";
export type {
    AccessToken,
    AccessTokenBody,
    AccessTokenHeader,
    ConnectTokenErrorCode,
    RefreshToken,
    RefreshTokenBody,
    RefreshTokenHeader,
} from "./token";

export const DEFAULT_PUBLIC_KEY_LOCALE = "en-US";

export interface ConnectClientOptions {
    baseUrl: string;
    fetch?: typeof globalThis.fetch;
    publicKeyFetchLocale?: string;
}

export class ConnectApiError extends Error {

    public readonly status: number;
    public readonly reason?: string;
    public readonly body?: ConnectErrorBody;

    public constructor(
        status: number,
        reason: string | undefined,
        body: ConnectErrorBody | undefined,
    ) {

        super(
            typeof reason === "string"
                ? `Connect API error ${status}: ${reason}`
                : `Connect API error ${status}`,
        );
        this.name = "ConnectApiError";
        this.status = status;
        this.reason = reason;
        this.body = body;
    }
}

export interface GetApplicationPublicKeyOptions {
    force?: boolean;
}

export class ConnectClient {

    private readonly _baseUrl: string;
    private readonly _fetch: typeof globalThis.fetch;
    private readonly _publicKeyLocale: string;
    private readonly _publicKeyCache: Map<string, string>;

    public constructor(options: ConnectClientOptions) {

        this._baseUrl = options.baseUrl.replace(/\/+$/, "");
        this._fetch = options.fetch ?? globalThis.fetch;
        this._publicKeyLocale = options.publicKeyFetchLocale ?? DEFAULT_PUBLIC_KEY_LOCALE;
        this._publicKeyCache = new Map();
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

        return this._verify(jwt, ACCESS_TOKEN_KEY_TYPE, parseAccessToken) as Promise<AccessToken>;
    }

    public async verifyRefreshToken(jwt: string): Promise<RefreshToken> {

        return this._verify(jwt, REFRESH_TOKEN_KEY_TYPE, parseRefreshToken) as Promise<RefreshToken>;
    }

    private async _verify(
        jwt: string,
        expectedKeyType: string,
        parser: (jwt: string) => AccessToken | RefreshToken | null,
    ): Promise<AccessToken | RefreshToken> {

        const parsed: AccessToken | RefreshToken | null = parser(jwt);

        if (parsed === null) {

            throw new ConnectTokenError("INVALID_JWT", "Token is not a parseable JWT.");
        }

        if (parsed.header.kty !== expectedKeyType) {

            throw new ConnectTokenError(
                "WRONG_KEY_TYPE",
                `Expected key type "${expectedKeyType}", got "${parsed.header.kty ?? ""}".`,
            );
        }

        const audience: string | undefined = parsed.header.aud;

        if (typeof audience !== "string" || audience.length === 0) {

            throw new ConnectTokenError(
                "MISSING_AUDIENCE",
                "Token is missing the `aud` (applicationAnchor) header.",
            );
        }

        if (!parsed.verifyExpiration(new Date())) {

            throw new ConnectTokenError("EXPIRED", "Token has expired.");
        }

        const publicKey: string = await this.getApplicationPublicKey(audience);

        if (!parsed.verifySignature(publicKey)) {

            throw new ConnectTokenError(
                "INVALID_SIGNATURE",
                "Token signature does not match the application public key.",
            );
        }

        return parsed;
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
