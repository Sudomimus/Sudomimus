import { ConnectClient } from "@sudomimus/connect";
import { SessionClient } from "@sudomimus/session";
import { ConnectWeb, MemoryWebAuthStore } from "../src/index.js";

const origin = "https://example.test";

function request(path: string, method: string, cookie?: string): Request {
    return new Request(`${origin}${path}`, {
        method,
        headers: { origin, ...(cookie ? { cookie } : {}) },
    });
}

test("callback redeems once, refreshes atomically, and logs out", async () => {
    const connect = {
        establish: jest.fn().mockResolvedValue({ exposureKey: "exp_one", hiddenKey: "hid_secret" }),
        redeem: jest.fn().mockResolvedValue({ accessToken: "access-1", refreshToken: "refresh-1" }),
    } as unknown as ConnectClient;
    const session = {
        verifyAccessToken: jest.fn()
            .mockResolvedValueOnce({ body: { sub: "subject", exp: Math.floor(Date.now() / 1000) + 1 } })
            .mockResolvedValue({ body: { sub: "subject", exp: Math.floor(Date.now() / 1000) + 3600 } }),
        refresh: jest.fn().mockResolvedValue({ accessToken: "access-2", refreshToken: "refresh-2" }),
        logout: jest.fn().mockResolvedValue({}),
    } as unknown as SessionClient;
    const web = new ConnectWeb({
        applicationAnchor: "my-app",
        callbackUrl: `${origin}/auth/callback`,
        afterLoginUrl: "/home",
        afterLogoutUrl: "/",
        connect,
        session,
        store: new MemoryWebAuthStore(),
    });

    const started = await web.start(request("/login", "POST"));
    expect(started.status).toBe(303);
    expect(started.headers.get("location")).toContain("exposure-key=exp_one");
    expect(started.headers.get("set-cookie")).not.toContain("hid_secret");
    const pendingCookie = started.headers.get("set-cookie")!.split(";")[0];

    const callbackRequest = request("/auth/callback?exposure-key=exp_one&confirmation-key=cnf_one", "GET", pendingCookie);
    const completed = await web.callback(callbackRequest);
    expect(completed.status).toBe(303);
    expect(await web.callback(callbackRequest).then((response) => response.status)).toBe(400);
    expect(connect.redeem).toHaveBeenCalledTimes(1);
    const sessionCookie = completed.headers.get("set-cookie")!.match(/sudomimus_session=[^;]+/)![0];

    const currentRequest = request("/account", "GET", sessionCookie);
    const [first, second] = await Promise.all([web.current(currentRequest), web.current(currentRequest)]);
    expect(first?.accessToken).toBe("access-2");
    expect(second?.accessToken).toBe("access-2");
    expect(session.refresh).toHaveBeenCalledTimes(1);
    expect((await web.logout(request("/logout", "POST", sessionCookie))).status).toBe(303);
    expect(session.logout).toHaveBeenCalledWith({ refreshToken: "refresh-2" });
    expect(await web.current(currentRequest)).toBeUndefined();
});

test("cross-origin login is rejected before establish", async () => {
    const connect = { establish: jest.fn() } as unknown as ConnectClient;
    const web = new ConnectWeb({
        applicationAnchor: "my-app", callbackUrl: `${origin}/callback`,
        afterLoginUrl: "/", afterLogoutUrl: "/", connect,
        session: {} as SessionClient, store: new MemoryWebAuthStore(),
    });
    const response = await web.start(new Request(`${origin}/login`, { method: "POST", headers: { origin: "https://other.test" } }));
    expect(response.status).toBe(403);
    expect(connect.establish).not.toHaveBeenCalled();
});
