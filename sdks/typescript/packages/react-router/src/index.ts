import { ConnectWeb, type WebAuthOptions } from "@sudomimus/web";

type RouteArgs = { request: Request };

/** Map start/logout to route actions and callback to a route loader. */
export function createReactRouterHandlers(options: WebAuthOptions) {
    const web = new ConnectWeb(options);
    return {
        startAction: ({ request }: RouteArgs) => web.start(request),
        callbackLoader: ({ request }: RouteArgs) => web.callback(request),
        logoutAction: ({ request }: RouteArgs) => web.logout(request),
        current: ({ request }: RouteArgs) => web.current(request),
    };
}
