import { createServer } from "node:http";
import { ConnectClient } from "@sudomimus/connect";
import { SessionClient } from "@sudomimus/session";
import { ConnectWeb, MemoryWebAuthStore } from "@sudomimus/web";

const applicationAnchor = process.env.SUDOMIMUS_APPLICATION_ANCHOR;
const privateKeyPem = process.env.SUDOMIMUS_PRIVATE_KEY_PEM;
if (!applicationAnchor || !privateKeyPem) {
    console.error("Set SUDOMIMUS_APPLICATION_ANCHOR and SUDOMIMUS_PRIVATE_KEY_PEM first.");
    process.exit(1);
}

const origin = "http://localhost:5173";
const web = new ConnectWeb({
    applicationAnchor,
    callbackUrl: `${origin}/auth/callback`,
    afterLoginUrl: "/",
    afterLogoutUrl: "/",
    connect: new ConnectClient({
        clientAuth: { applicationAnchor, privateKeyPem },
    }),
    session: new SessionClient(),
    store: new MemoryWebAuthStore(),
});

createServer(async (incoming, outgoing) => {
    try {
        const path = new URL(incoming.url ?? "/", origin).pathname;
        const request = new Request(new URL(incoming.url ?? "/", origin), {
            method: incoming.method,
            headers: incoming.headers,
        });
        let response;
        switch (path) {
            case "/auth/start":
                response = await web.start(request);
                break;
            case "/auth/callback":
                response = await web.callback(request);
                break;
            case "/auth/logout":
                response = await web.logout(request);
                break;
            case "/auth/me": {
                if (request.method !== "GET") {
                    response = new Response(null, { status: 405 });
                    break;
                }
                const session = await web.current(request);
                response = Response.json(session ? { subject: session.subject } : null, {
                    headers: { "Cache-Control": "no-store" },
                });
                break;
            }
            default:
                response = new Response(null, { status: 404 });
        }

        const headers = Object.fromEntries(response.headers);
        const cookies = response.headers.getSetCookie();
        if (cookies.length) headers["set-cookie"] = cookies;
        outgoing.writeHead(response.status, headers);
        outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
        console.error(error);
        outgoing.writeHead(500);
        outgoing.end("Login server error");
    }
}).listen(3000, "127.0.0.1", () => {
    console.log("Sudomimus example backend listening on http://127.0.0.1:3000");
});
