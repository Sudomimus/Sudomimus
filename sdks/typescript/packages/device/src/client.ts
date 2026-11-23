/**
 * @author WMXPY
 * @package Device
 * @namespace Root
 * @description Client
 */

import type {
    DeviceAuthorizeRequest,
    DeviceAuthorizeResponse,
    DeviceClientOptions,
    DeviceErrorBody,
    DeviceTokenErrorBody,
    DeviceTokenRequest,
    DeviceTokenResponse,
    HealthResponse,
} from "./declare.js";
import { PRODUCTION_BASE_URL } from "./constants.js";
import { DeviceApiError, DeviceTokenApiError } from "./error.js";

const USER_CODE_PATTERN = /^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{4}-[0-9ABCDEFGHJKMNPQRSTVWXYZ]{4}$/u;
const LOOPBACK_AUTHORITY = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::[0-9]+)?$/iu;

function isVerificationUrl(value: unknown): boolean {

    if (typeof value !== "string" || value.trim() !== value || value.includes("\\")) {

        return false;
    }

    const authority = /^https?:\/\/([^/?#\\]+)/iu.exec(value)?.[1];
    if (!authority || authority.includes("@")) {

        return false;
    }

    for (const character of value) {

        const code = character.charCodeAt(0);
        if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) {

            return false;
        }
    }

    try {

        const url = new URL(value);
        return url.username === "" && url.password === ""
            && (url.protocol === "https:"
                || (url.protocol === "http:" && LOOPBACK_AUTHORITY.test(authority)));
    } catch {

        return false;
    }
}

export class DeviceClient {

    private readonly _baseUrl: string;
    private readonly _fetch: typeof globalThis.fetch;

    public constructor(options: DeviceClientOptions = {}) {

        this._baseUrl = (options.baseUrl ?? PRODUCTION_BASE_URL).replace(/\/+$/, "");
        this._fetch = (options.fetch ?? globalThis.fetch).bind(globalThis);
    }

    public get baseUrl(): string {

        return this._baseUrl;
    }

    public get fetch(): typeof globalThis.fetch {

        return this._fetch;
    }

    public async health(): Promise<HealthResponse> {

        const response: Response = await this._fetch(`${this._baseUrl}/health`, {
            method: "GET",
            headers: {
                "Accept": "application/json",
            },
        });
        return this._handle<HealthResponse>(response);
    }

    public async deviceAuthorize(
        request: DeviceAuthorizeRequest,
        signal?: AbortSignal,
    ): Promise<DeviceAuthorizeResponse> {

        const authorization = await this._post<DeviceAuthorizeRequest, DeviceAuthorizeResponse>(
            "/device-authorize",
            request,
            signal,
        );

        if (typeof authorization?.userCode !== "string"
            || authorization.userCode.length !== 9
            || !USER_CODE_PATTERN.test(authorization.userCode)
            || !isVerificationUrl(authorization.verificationUri)
            || !isVerificationUrl(authorization.verificationUriComplete)
            || !Number.isInteger(authorization.expiresIn)
            || authorization.expiresIn <= 0
            || !Number.isInteger(authorization.interval)
            || authorization.interval <= 0) {

            throw new TypeError("Invalid device authorization response.");
        }

        return authorization;
    }

    public async deviceToken(
        request: DeviceTokenRequest,
        signal?: AbortSignal,
    ): Promise<DeviceTokenResponse> {

        return this._post<DeviceTokenRequest, DeviceTokenResponse>(
            "/device-token",
            request,
            signal,
        );
    }

    private async _post<TReq, TRes>(
        path: string,
        body: TReq,
        signal?: AbortSignal,
    ): Promise<TRes> {

        const response: Response = await this._fetch(`${this._baseUrl}${path}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            body: JSON.stringify(body),
            ...(signal ? { signal } : {}),
        });
        return this._handle<TRes>(response);
    }

    private async _handle<TRes>(response: Response): Promise<TRes> {

        if (response.ok) {

            return await response.json() as TRes;
        }

        const errorBody: unknown = await this._tryReadErrorBody(response);

        if (this._isDeviceTokenErrorBody(errorBody)) {

            throw new DeviceTokenApiError(response.status, errorBody);
        }

        const body: DeviceErrorBody | undefined = this._isDeviceErrorBody(errorBody)
            ? errorBody
            : undefined;

        throw new DeviceApiError(
            response.status,
            body?.reason,
            body,
        );
    }

    private async _tryReadErrorBody(response: Response): Promise<unknown> {

        const text: string = await response.text();

        if (text.length === 0) {

            return undefined;
        }

        try {

            return JSON.parse(text);
        } catch {

            return undefined;
        }
    }

    private _isDeviceTokenErrorBody(body: unknown): body is DeviceTokenErrorBody {

        return typeof body === "object"
            && body !== null
            && "error" in body
            && typeof (body as { error?: unknown }).error === "string";
    }

    private _isDeviceErrorBody(body: unknown): body is DeviceErrorBody {

        return typeof body === "object"
            && body !== null
            && (
                !("reason" in body)
                || typeof (body as { reason?: unknown }).reason === "string"
            );
    }
}
