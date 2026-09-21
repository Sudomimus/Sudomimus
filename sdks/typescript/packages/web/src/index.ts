import { randomUUID } from "node:crypto";
import { ConnectClient, RETURN_METHOD } from "@sudomimus/connect";
import { SessionApiError, SessionClient } from "@sudomimus/session";
export { MemoryWebAuthStore } from "./memory-store.js";

export interface PendingLogin {
    exposureKey: string;
    hiddenKey: string;
}

export interface WebSession {
    subject: string;
    accessToken: string;
    refreshToken: string;
    accessExpiresAt: number;
}

/** Implement with a shared, durable store in multi-instance deployments. */
export interface WebAuthStore {
    putPending(key: string, value: PendingLogin, ttlSeconds: number): Promise<void>;
    takePending(key: string, exposureKey: string): Promise<PendingLogin | undefined>;
    putSession(key: string, value: WebSession, ttlSeconds: number): Promise<void>;
    /** Execute and persist the callback atomically per session key. */
    withSession<T>(key: string, update: (session: WebSession | undefined) => Promise<{ value: WebSession | undefined; result: T }>): Promise<T>;
}

export interface WebAuthOptions {
    applicationAnchor: string;
    callbackUrl: string;
    afterLoginUrl: string;
    afterLogoutUrl: string;
    connect: ConnectClient;
    session: SessionClient;
    store: WebAuthStore;
    viaUrl?: string;
    pendingTtlSeconds?: number;
    sessionTtlSeconds?: number;
}

const PENDING_COOKIE = "sudomimus_pending";
const SESSION_COOKIE = "sudomimus_session";

function readCookie(request: Request, name: string): string | undefined {
    const entry = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
    return entry === undefined ? undefined : decodeURIComponent(entry.slice(name.length + 1));
}

function cookie(name: string, value: string, secure: boolean, maxAge: number): string {
    return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

function redirect(url: string, setCookie?: string): Response {
    const headers = new Headers({ Location: url, "Cache-Control": "no-store" });
    if (setCookie) headers.append("Set-Cookie", setCookie);
    return new Response(null, { status: 303, headers });
}

export class ConnectWeb {
    public constructor(private readonly options: WebAuthOptions) {
        const callback = new URL(options.callbackUrl);
        if (callback.searchParams.has("exposure-key") || callback.searchParams.has("confirmation-key")) {
            throw new Error("callbackUrl must not contain Inquiry keys");
        }
    }

    public async start(request: Request): Promise<Response> {
        if (request.method !== "POST") return new Response(null, { status: 405 });
        if (!this.sameOrigin(request)) return new Response("Invalid request origin", { status: 403 });
        const state = randomUUID();
        const inquiry = await this.options.connect.establish({
            applicationAnchor: this.options.applicationAnchor,
            returnMethods: [{ type: RETURN_METHOD.CALLBACK, payload: { callbackUrl: this.options.callbackUrl } }],
        });
        await this.options.store.putPending(state, {
            exposureKey: inquiry.exposureKey,
            hiddenKey: inquiry.hiddenKey,
        }, this.options.pendingTtlSeconds ?? 600);
        const via = new URL(this.options.viaUrl ?? "https://via.sudomimus.com/");
        via.searchParams.set("exposure-key", inquiry.exposureKey);
        return redirect(via.toString(), cookie(PENDING_COOKIE, state, this.secure, this.options.pendingTtlSeconds ?? 600));
    }

    public async callback(request: Request): Promise<Response> {
        if (request.method !== "GET") return new Response(null, { status: 405 });
        const query = new URL(request.url).searchParams;
        const state = readCookie(request, PENDING_COOKIE);
        const exposureKey = query.get("exposure-key");
        const confirmationKey = query.get("confirmation-key");
        if (!state || !exposureKey || !confirmationKey) return new Response("Invalid login callback", { status: 400 });
        const pending = await this.options.store.takePending(state, exposureKey);
        if (!pending) return new Response("Login expired or already used", { status: 400 });
        const issued = await this.options.connect.redeem({ exposureKey, hiddenKey: pending.hiddenKey, confirmationKey });
        const verified = await this.options.session.verifyAccessToken(issued.accessToken);
        const sessionId = randomUUID();
        await this.options.store.putSession(sessionId, {
            subject: verified.body.sub,
            accessToken: issued.accessToken,
            refreshToken: issued.refreshToken,
            accessExpiresAt: verified.body.exp * 1000,
        }, this.options.sessionTtlSeconds ?? 2592000);
        const response = redirect(this.options.afterLoginUrl, cookie(SESSION_COOKIE, sessionId, this.secure, this.options.sessionTtlSeconds ?? 2592000));
        response.headers.append("Set-Cookie", cookie(PENDING_COOKIE, "", this.secure, 0));
        return response;
    }

    public async current(request: Request): Promise<WebSession | undefined> {
        const id = readCookie(request, SESSION_COOKIE);
        if (!id) return undefined;
        return this.options.store.withSession(id, async (current) => {
            if (!current) return { value: undefined, result: undefined };
            if (current.accessExpiresAt > Date.now() + 30000) return { value: current, result: current };
            try {
                const rotated = await this.options.session.refresh({ refreshToken: current.refreshToken });
                const verified = await this.options.session.verifyAccessToken(rotated.accessToken);
                if (verified.body.sub !== current.subject) throw new Error("Session subject changed");
                const value = {
                    ...current,
                    accessToken: rotated.accessToken,
                    refreshToken: rotated.refreshToken,
                    accessExpiresAt: verified.body.exp * 1000,
                };
                return { value, result: value };
            } catch (error) {
                if (error instanceof SessionApiError && error.status === 401) {
                    return { value: undefined, result: undefined };
                }
                throw error;
            }
        });
    }

    public async logout(request: Request): Promise<Response> {
        if (request.method !== "POST") return new Response(null, { status: 405 });
        if (!this.sameOrigin(request)) return new Response("Invalid request origin", { status: 403 });
        const id = readCookie(request, SESSION_COOKIE);
        if (id) {
            await this.options.store.withSession(id, async (current) => {
                if (current) await this.options.session.logout({ refreshToken: current.refreshToken });
                return { value: undefined, result: undefined };
            });
        }
        const response = redirect(this.options.afterLogoutUrl, cookie(SESSION_COOKIE, "", this.secure, 0));
        response.headers.append("Set-Cookie", cookie(PENDING_COOKIE, "", this.secure, 0));
        return response;
    }

    private get secure(): boolean {
        return new URL(this.options.callbackUrl).protocol === "https:";
    }

    private sameOrigin(request: Request): boolean {
        const origin = request.headers.get("origin");
        return origin !== null && origin === new URL(this.options.callbackUrl).origin;
    }
}
