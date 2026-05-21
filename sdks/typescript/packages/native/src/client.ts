/**
 * @author Sudomimus Contributors
 * @package Native
 * @namespace Client
 * @description Native HTTP client
 */

import type {
    DirectIssueSteamTicketRequest,
    DirectIssueSteamTicketResponse,
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
