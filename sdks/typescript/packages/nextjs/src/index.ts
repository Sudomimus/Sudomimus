import { ConnectWeb, type WebAuthOptions } from "@sudomimus/web";

/** Use in Next.js App Router route.ts files; pass each member as POST or GET. */
export function createNextHandlers(options: WebAuthOptions) {
    const web = new ConnectWeb(options);
    return {
        start: (request: Request) => web.start(request),
        callback: (request: Request) => web.callback(request),
        logout: (request: Request) => web.logout(request),
        current: (request: Request) => web.current(request),
        currentFromCookieHeader: (cookieHeader: string) => web.current(new Request(options.callbackUrl, {
            headers: { cookie: cookieHeader },
        })),
    };
}
