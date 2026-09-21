import { ConnectWeb, type WebAuthOptions } from "@sudomimus/web";

interface NodeEvent {
    node: { req: { url?: string; method?: string; headers: { cookie?: string; origin?: string } } };
}

/** Nuxt server route adapter for the Node/Nitro preset. */
export function createNuxtHandlers(options: WebAuthOptions) {
    const web = new ConnectWeb(options);
    const request = (event: NodeEvent): Request => new Request(
        new URL(event.node.req.url ?? "/", options.callbackUrl),
        { method: event.node.req.method ?? "GET", headers: {
            cookie: event.node.req.headers.cookie ?? "",
            origin: event.node.req.headers.origin ?? "",
        } },
    );
    return {
        start: (event: NodeEvent) => web.start(request(event)),
        callback: (event: NodeEvent) => web.callback(request(event)),
        logout: (event: NodeEvent) => web.logout(request(event)),
        current: (event: NodeEvent) => web.current(request(event)),
    };
}
