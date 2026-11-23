/**
 * @author WMXPY
 * @package Device
 * @namespace Root
 * @description Authenticator
 */

import type { TokenPair, TokenStore } from "@sudomimus/session";
import type { DeviceClient } from "./client.js";
import type {
    DeviceAuthorizeRequest,
    DeviceAuthorizeResponse,
    DeviceTokenResponse,
} from "./declare.js";
import { DevicePollTimeoutError, DeviceTokenApiError } from "./error.js";

export type DeviceOpenUrl = (
    url: string,
    authorization: DeviceAuthorizeResponse,
) => void | Promise<void>;

export type DeviceSleep = (
    milliseconds: number,
    signal?: AbortSignal,
) => Promise<void>;

export type DevicePollProgress = {
    readonly authorization: DeviceAuthorizeResponse;
    readonly attempt: number;
    readonly error: "authorization_pending" | "slow_down";
    readonly nextIntervalSeconds: number;
};

export type DeviceAuthorizationResult = {
    readonly authorization: DeviceAuthorizeResponse;
    readonly tokens: DeviceTokenResponse;
};

export interface DeviceAuthenticatorOptions {
    /**
     * Optional Connect-compatible per-session token store. When provided,
     * successful device authorization writes the issued pair here before
     * returning. Use the same store with `RotatingSessionClient` for later
     * `/refresh` and `/logout`.
     */
    store?: TokenStore;
    openUrl?: DeviceOpenUrl;
    sleep?: DeviceSleep;
    now?: () => number;
}

export interface DevicePollOptions {
    store?: TokenStore;
    openUrl?: DeviceOpenUrl;
    onAuthorize?: (authorization: DeviceAuthorizeResponse) => void | Promise<void>;
    onPoll?: (progress: DevicePollProgress) => void | Promise<void>;
    pollTimeoutSeconds?: number;
    signal?: AbortSignal;
}

export class DeviceAuthenticator {

    private readonly _client: DeviceClient;
    private readonly _store: TokenStore | undefined;
    private readonly _openUrl: DeviceOpenUrl | undefined;
    private readonly _sleep: DeviceSleep;
    private readonly _now: () => number;

    public constructor(client: DeviceClient, options: DeviceAuthenticatorOptions = {}) {

        this._client = client;
        this._store = options.store;
        this._openUrl = options.openUrl;
        this._sleep = options.sleep ?? defaultSleep;
        this._now = options.now ?? Date.now;
    }

    public get client(): DeviceClient {

        return this._client;
    }

    public get store(): TokenStore | undefined {

        return this._store;
    }

    /**
     * Start device authorization, optionally open the browser, then poll
     * `/device-token` until tokens are issued or a terminal device-flow error
     * is returned.
     */
    public async authorizeAndPoll(
        request: DeviceAuthorizeRequest,
        options: DevicePollOptions = {},
    ): Promise<DeviceAuthorizationResult> {

        this._throwIfAborted(options.signal);
        const authorization = await this._client.deviceAuthorize(request, options.signal);
        const startedAt = this._now();
        this._throwIfAborted(options.signal);

        if (typeof options.onAuthorize === "function") {

            await options.onAuthorize(authorization);
        }

        const openUrl: DeviceOpenUrl | undefined = options.openUrl ?? this._openUrl;

        this._throwIfAborted(options.signal);
        if (typeof openUrl === "function") {

            await openUrl(authorization.verificationUriComplete, authorization);
        }

        const tokens = await this._pollForToken(authorization, options, startedAt);

        return { authorization, tokens };
    }

    /**
     * Automatically poll an existing device authorization session. This is the
     * automatic counterpart to manually catching `DeviceTokenApiError` from
     * `DeviceClient.deviceToken()`.
     */
    public async pollForToken(
        authorization: DeviceAuthorizeResponse,
        options: DevicePollOptions = {},
    ): Promise<DeviceTokenResponse> {

        return this._pollForToken(authorization, options, this._now());
    }

    private async _pollForToken(
        authorization: DeviceAuthorizeResponse,
        options: DevicePollOptions,
        startedAt: number,
    ): Promise<DeviceTokenResponse> {

        const lifetime = Math.min(
            authorization.expiresIn,
            options.pollTimeoutSeconds ?? authorization.expiresIn,
        );
        const deadline = startedAt + lifetime * 1000;
        let intervalSeconds = authorization.interval;
        let nextPollAt = startedAt + intervalSeconds * 1000;
        let attempt = 0;

        while (true) {

            this._throwIfAborted(options.signal);
            const waitMilliseconds = Math.min(nextPollAt, deadline) - this._now();
            if (waitMilliseconds > 0) {

                await this._sleep(waitMilliseconds, options.signal);
            }

            this._throwIfAborted(options.signal);
            if (this._now() >= deadline) {

                throw new DevicePollTimeoutError(authorization);
            }

            attempt += 1;
            let tokens: DeviceTokenResponse;
            try {

                tokens = await this._client.deviceToken({
                    deviceCode: authorization.deviceCode,
                }, options.signal);
            } catch (error) {

                this._throwIfAborted(options.signal);
                if (!(error instanceof DeviceTokenApiError)
                    || (error.error !== "authorization_pending" && error.error !== "slow_down")) {

                    throw error;
                }

                if (error.error === "slow_down") {

                    intervalSeconds = typeof error.interval === "number"
                        && Number.isInteger(error.interval)
                        && error.interval > 0
                        ? error.interval
                        : intervalSeconds + 5;
                }

                nextPollAt = this._now() + intervalSeconds * 1000;
                if (typeof options.onPoll === "function") {

                    await options.onPoll({
                        authorization,
                        attempt,
                        error: error.error,
                        nextIntervalSeconds: intervalSeconds,
                    });
                }
                continue;
            }

            this._throwIfAborted(options.signal);
            await this._persist(tokens, options.store);

            return tokens;
        }
    }

    public async seed(tokens: TokenPair): Promise<void> {

        await this._requireStore("seed").save({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
        });
    }

    public async getAccessToken(): Promise<string | null> {

        const pair: TokenPair | null = await this._requireStore("getAccessToken").load();
        return pair?.accessToken ?? null;
    }

    public async getTokens(): Promise<TokenPair | null> {

        return this._requireStore("getTokens").load();
    }

    private async _persist(tokens: DeviceTokenResponse, storeOverride?: TokenStore): Promise<void> {

        const store: TokenStore | undefined = storeOverride ?? this._store;

        if (typeof store === "undefined") {

            return;
        }

        await store.save({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
        });
    }

    private _requireStore(method: string): TokenStore {

        if (typeof this._store === "undefined") {

            throw new Error(`DeviceAuthenticator.${method}() requires a TokenStore.`);
        }

        return this._store;
    }

    private _throwIfAborted(signal: AbortSignal | undefined): void {

        if (signal?.aborted === true) {

            throw new Error("Device authorization polling was aborted.");
        }
    }
}

const defaultSleep: DeviceSleep = async (
    milliseconds: number,
    signal?: AbortSignal,
): Promise<void> =>
    new Promise((resolve, reject) => {

        if (signal?.aborted === true) {

            reject(new Error("Device authorization polling was aborted."));
            return;
        }

        const timeout = setTimeout(() => {

            signal?.removeEventListener("abort", abort);
            resolve();
        }, milliseconds);
        const abort = (): void => {

            clearTimeout(timeout);
            reject(new Error("Device authorization polling was aborted."));
        };

        signal?.addEventListener("abort", abort, { once: true });
    });
