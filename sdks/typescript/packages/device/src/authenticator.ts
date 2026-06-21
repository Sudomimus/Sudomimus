/**
 * @author Sudomimus Contributors
 * @package Device
 * @namespace Authenticator
 * @description High-level device authorization helper
 */

import type { TokenPair, TokenStore } from "@sudomimus/connect";
import type { DeviceClient } from "./client";
import type {
    DeviceAuthorizeRequest,
    DeviceAuthorizeResponse,
    DeviceTokenResponse,
} from "./declare";
import { DevicePollTimeoutError, DeviceTokenApiError } from "./error";

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
     * returning. Use the same store with `RotatingConnectClient` for later
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

        const authorization: DeviceAuthorizeResponse = await this._client.deviceAuthorize(request);

        if (typeof options.onAuthorize === "function") {

            await options.onAuthorize(authorization);
        }

        const openUrl: DeviceOpenUrl | undefined = options.openUrl ?? this._openUrl;

        if (typeof openUrl === "function") {

            await openUrl(authorization.verificationUriComplete, authorization);
        }

        const tokens: DeviceTokenResponse = await this.pollForToken(authorization, options);

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

        const deadline: number = this._deadline(authorization, options.pollTimeoutSeconds);
        let intervalSeconds: number = Math.max(1, authorization.interval);
        let attempt = 0;

        while (true) {

            this._throwIfAborted(options.signal);

            if (this._now() > deadline) {

                throw new DevicePollTimeoutError(authorization);
            }

            attempt += 1;

            try {

                const tokens: DeviceTokenResponse = await this._client.deviceToken({
                    deviceCode: authorization.deviceCode,
                });
                await this._persist(tokens, options.store);
                return tokens;
            } catch (error) {

                if (!(error instanceof DeviceTokenApiError)) {

                    throw error;
                }

                if (error.error !== "authorization_pending" && error.error !== "slow_down") {

                    throw error;
                }

                if (error.error === "slow_down") {

                    intervalSeconds = typeof error.interval === "number"
                        ? Math.max(1, error.interval)
                        : intervalSeconds + 5;
                }

                if (typeof options.onPoll === "function") {

                    await options.onPoll({
                        authorization,
                        attempt,
                        error: error.error,
                        nextIntervalSeconds: intervalSeconds,
                    });
                }

                const sleepMilliseconds: number = Math.min(
                    intervalSeconds * 1000,
                    Math.max(0, deadline - this._now()),
                );
                await this._sleep(sleepMilliseconds, options.signal);
            }
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

    private _deadline(
        authorization: DeviceAuthorizeResponse,
        pollTimeoutSeconds: number | undefined,
    ): number {

        const expiresAt: number = this._now() + Math.max(1, authorization.expiresIn) * 1000;

        if (typeof pollTimeoutSeconds !== "number") {

            return expiresAt;
        }

        const timeoutAt: number = this._now() + Math.max(0, pollTimeoutSeconds) * 1000;
        return Math.min(expiresAt, timeoutAt);
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
