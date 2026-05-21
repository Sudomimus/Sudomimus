/**
 * Sudomimus Connect SDK — React example.
 *
 * Single-page MVP that drives the full login flow in the browser.
 *
 * Phases:
 *   - "form":  Collect applicationAnchor + private key, call /establish,
 *              persist hiddenKey to sessionStorage, redirect to via.sudomimus.com.
 *   - "done":  On the CALLBACK landing (URL has both exposure-key and
 *              confirmation-key), restore hiddenKey, call /redeem, decode
 *              the access token, render the logged-in user.
 *
 * ⚠️ This example accepts the application's private key in a textarea as a
 *    convenience for local demo only. Real integrations MUST sign the
 *    /establish JWT on a backend — never embed the private key in client
 *    code.
 */

import { useEffect, useState } from "react";
import { ConnectClient, RETURN_METHOD } from "@sudomimus/connect";
import { createBrowserSigner, decodeAccessTokenBody } from "./browser-signer";

const CONNECT_BASE_URL = "https://connect-api.sudomimus.com";
const LOGIN_UI_BASE = "https://via.sudomimus.com";

const hiddenKeyStorageKey = (exposureKey: string) => `sudomimus-hk:${exposureKey}`;

const currentCallbackUrl = (): string =>
    window.location.origin + window.location.pathname;

const readCallbackParams = (): { exposureKey: string; confirmationKey: string } | null => {

    const params = new URLSearchParams(window.location.search);
    const exposureKey = params.get("exposure-key");
    const confirmationKey = params.get("confirmation-key");
    if (exposureKey && confirmationKey) {
        return { exposureKey, confirmationKey };
    }
    return null;
};

type AccessTokenBody = {
    accountIdentifier: string;
    firstName: string;
    lastName?: string;
};

type DoneState =
    | { status: "loading" }
    | { status: "ok"; user: AccessTokenBody }
    | { status: "error"; message: string };

export const App = () => {

    const callback = typeof window !== "undefined" ? readCallbackParams() : null;

    if (callback) {
        return <DoneView exposureKey={callback.exposureKey} confirmationKey={callback.confirmationKey} />;
    }
    return <LoginForm />;
};

const LoginForm = () => {

    const [applicationAnchor, setApplicationAnchor] = useState("");
    const [privateKeyPem, setPrivateKeyPem] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onSubmit = async (event: React.FormEvent) => {

        event.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            const anchor = applicationAnchor.trim();
            const signer = await createBrowserSigner({
                applicationAnchor: anchor,
                privateKeyPem,
            });
            const client = new ConnectClient({
                baseUrl: CONNECT_BASE_URL,
                clientAuth: {
                    applicationAnchor: anchor,
                    signer,
                },
            });
            const { exposureKey, hiddenKey } = await client.establish({
                applicationAnchor: anchor,
                returnMethods: [{
                    type: RETURN_METHOD.CALLBACK,
                    payload: { callbackUrl: currentCallbackUrl() },
                }],
            });
            sessionStorage.setItem(hiddenKeyStorageKey(exposureKey), hiddenKey);
            window.location.href = `${LOGIN_UI_BASE}/?exposure-key=${encodeURIComponent(exposureKey)}`;
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setSubmitting(false);
        }
    };

    return (
        <main>
            <h1>Sudomimus Connect — React example</h1>
            <p style={{ color: "darkred" }}>
                ⚠️ DEMO ONLY. Pasting a real production private key into a
                browser is not safe. Real integrations should sign the
                /establish JWT on a backend.
            </p>
            <form onSubmit={onSubmit}>
                <div>
                    <label htmlFor="anchor">applicationAnchor</label>
                    <br />
                    <input
                        id="anchor"
                        value={applicationAnchor}
                        onChange={(e) => setApplicationAnchor(e.target.value)}
                        required
                        size={48}
                    />
                </div>
                <br />
                <div>
                    <label htmlFor="pem">client-auth private key (PEM)</label>
                    <br />
                    <textarea
                        id="pem"
                        value={privateKeyPem}
                        onChange={(e) => setPrivateKeyPem(e.target.value)}
                        required
                        rows={12}
                        cols={64}
                        placeholder={"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"}
                    />
                </div>
                <br />
                <button type="submit" disabled={submitting}>
                    {submitting ? "Establishing..." : "Login"}
                </button>
            </form>
            {error && (
                <pre style={{ color: "darkred", whiteSpace: "pre-wrap" }}>
                    {error}
                </pre>
            )}
        </main>
    );
};

type DoneViewProps = {
    exposureKey: string;
    confirmationKey: string;
};

const DoneView = ({ exposureKey, confirmationKey }: DoneViewProps) => {

    const [state, setState] = useState<DoneState>({ status: "loading" });

    useEffect(() => {

        const run = async () => {
            const hiddenKey = sessionStorage.getItem(hiddenKeyStorageKey(exposureKey));
            if (hiddenKey === null) {
                setState({
                    status: "error",
                    message: "Missing hiddenKey in sessionStorage. Start the login flow again from the same browser.",
                });
                return;
            }

            try {
                const client = new ConnectClient({ baseUrl: CONNECT_BASE_URL });
                const { accessToken } = await client.redeem({
                    exposureKey,
                    hiddenKey,
                    confirmationKey,
                });
                // For an MVP browser example we decode the access token
                // without verifying its signature — the SDK's verifier uses
                // Node `crypto`. Production code should verify on a backend.
                const user = decodeAccessTokenBody<AccessTokenBody>(accessToken);
                sessionStorage.removeItem(hiddenKeyStorageKey(exposureKey));
                setState({ status: "ok", user });
            } catch (err) {
                setState({
                    status: "error",
                    message: err instanceof Error ? err.message : String(err),
                });
            }
        };

        run();
    }, [exposureKey, confirmationKey]);

    return (
        <main>
            <h1>Sudomimus Connect — React example</h1>
            {state.status === "loading" && <p>Redeeming inquiry...</p>}
            {state.status === "error" && (
                <pre style={{ color: "darkred", whiteSpace: "pre-wrap" }}>
                    {state.message}
                </pre>
            )}
            {state.status === "ok" && (
                <>
                    <p>✓ Logged in.</p>
                    <pre>{JSON.stringify(state.user, null, 2)}</pre>
                    <p>
                        <a href={currentCallbackUrl()}>Start over</a>
                    </p>
                </>
            )}
        </main>
    );
};
