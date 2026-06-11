/**
 * @author Sudomimus Contributors
 * @package Native
 * @namespace Client
 * @description Native HTTP client
 */

import type {
    DirectIssueAccessKeyRequest,
    DirectIssueAccessKeyResponse,
    DirectIssueSteamTicketRequest,
    DirectIssueSteamTicketResponse,
    ErrandStatusResponse,
    NativeClientOptions,
    NativeErrorBody,
} from "./declare";
import { NativeApiError } from "./error";

export class NativeClient {

    private readonly _baseUrl: string;
    private readonly _fetch: typeof globalThis.fetch;

    public constructor(options: NativeClientOptions) {

        this._baseUrl = options.baseUrl.replace(/\/+$/, "");
        this._fetch = options.fetch ?? globalThis.fetch;
    }

    public get baseUrl(): string {

        return this._baseUrl;
    }

    public get fetch(): typeof globalThis.fetch {

        return this._fetch;
    }

    /**
     * Exchange a Steam Web API auth ticket for application access + refresh
     * tokens in a single round trip. The caller is responsible for
     * acquiring the ticket via Steamworks' `GetAuthTicketForWebApi`,
     * waiting for the `GetTicketForWebApiResponse_t` callback, and
     * hex-encoding the ticket bytes.
     */
    public async directIssueSteamTicket(
        request: DirectIssueSteamTicketRequest,
    ): Promise<DirectIssueSteamTicketResponse> {

        return this._post<DirectIssueSteamTicketRequest, DirectIssueSteamTicketResponse>(
            "/direct-issue/steam-ticket",
            request,
        );
    }

    /**
     * Exchange an access-key credential (identifier + secret) for
     * application access + refresh tokens. Access keys are issued in the
     * admin console against a specific account and are intended for
     * long-lived headless callers (CI runners, server-to-server scripts,
     * automation).
     */
    public async directIssueAccessKey(
        request: DirectIssueAccessKeyRequest,
    ): Promise<DirectIssueAccessKeyResponse> {

        return this._post<DirectIssueAccessKeyRequest, DirectIssueAccessKeyResponse>(
            "/direct-issue/access-key",
            request,
        );
    }

    /**
     * Poll the status of an errand handed back on a claim-gate 403 (the
     * `errand` field of the error body). A pure, side-effect-free read — safe
     * to call every couple of seconds while the user completes the browser
     * side-trip. Unknown, malformed, and expired keys all report `EXPIRED`
     * (the endpoint is not a key-validity oracle). On `COMPLETED`, retry the
     * original direct-issue request once.
     */
    public async errandStatus(
        errandKey: string,
    ): Promise<ErrandStatusResponse> {

        const path: string = `/errand/${encodeURIComponent(errandKey)}/status`;
        const response: Response = await this._fetch(`${this._baseUrl}${path}`, {
            method: "GET",
            headers: {
                "Accept": "application/json",
            },
        });
        return this._handle<ErrandStatusResponse>(response);
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

        const errorBody: NativeErrorBody | undefined = await this._tryReadErrorBody(response);
        throw new NativeApiError(
            response.status,
            errorBody?.reason,
            errorBody,
        );
    }

    private async _tryReadErrorBody(response: Response): Promise<NativeErrorBody | undefined> {

        const text: string = await response.text();

        if (text.length === 0) {

            return undefined;
        }

        try {

            return JSON.parse(text) as NativeErrorBody;
        } catch {

            return undefined;
        }
    }
}
