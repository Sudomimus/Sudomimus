/**
 * @author Sudomimus Contributors
 * @package Session
 * @namespace Client
 * @description Session HTTP client
 */

import { signSessionClientJwt } from "./client-auth.js";
import { CLIENT_JWT_AUTH_SCHEME, PRODUCTION_BASE_URL } from "./constants.js";
import type {
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
    SessionErrorBody,
} from "./declare.js";
import { SessionApiError, SessionConfigError } from "./error.js";

export class SessionClient {

    private readonly _baseUrl: string;
    private readonly _fetch: typeof globalThis.fetch;
    private readonly _clientAuth: SessionClientAuthConfig | undefined;

    public constructor(options: SessionClientOptions = {}) {

        this._baseUrl = (options.baseUrl ?? PRODUCTION_BASE_URL).replace(/\/+$/, "");
        this._fetch = (options.fetch ?? globalThis.fetch).bind(globalThis);
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

    public async refresh(request: RefreshRequest): Promise<RefreshResponse> {

        return this._post<RefreshRequest, RefreshResponse>("/refresh", request);
    }

    public async introspect(request: IntrospectRequest): Promise<IntrospectResponse> {

        return this._post<IntrospectRequest, IntrospectResponse>("/introspect", request);
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

        const errorBody: SessionErrorBody | undefined = await this._tryReadErrorBody(response);
        throw new SessionApiError(
            response.status,
            errorBody?.reason,
            errorBody,
        );
    }

    private async _tryReadErrorBody(response: Response): Promise<SessionErrorBody | undefined> {

        const text: string = await response.text();

        if (text.length === 0) {

            return undefined;
        }

        try {

            return JSON.parse(text) as SessionErrorBody;
        } catch {

            return undefined;
        }
    }
}
