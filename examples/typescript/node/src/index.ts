/**
 * Sudomimus Connect SDK — Node example.
 *
 * Interactive CLI login:
 *   1. Prompt the user for an applicationAnchor.
 *   2. Prompt the user to paste the application's client-auth private key (PEM).
 *   3. POST /establish (SDK signs the client-auth JWT automatically).
 *   4. Print the login URL — user opens it in a browser and authenticates.
 *   5. Poll /status-poll until REALIZED.
 *   6. POST /redeem and verify the issued access token.
 *   7. Print the subject (sector subject) as the "login succeeded" signal.
 *   8. Seed a RotatingSessionClient + InMemoryTokenStore from the pair, demo
 *      one /refresh rotation (the SDK persists the rotated pair into the
 *      store atomically — OAuth 2.1 BCP §4.14.2 strict mode).
 *   9. /logout via the rotating client, which best-effort revokes the
 *      current refresh token server-side and clears the store.
 */

import {
    ConnectClient,
    RETURN_METHOD,
} from "@sudomimus/connect";
import {
    InMemoryTokenStore,
    RotatingSessionClient,
    SessionClient,
} from "@sudomimus/session";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const CONNECT_BASE_URL = "https://connect-api.sudomimus.com";
const SESSION_BASE_URL = "https://session-api.sudomimus.com";
const LOGIN_UI_BASE = "https://via.sudomimus.com";
const POLL_INTERVAL_MS = 2000;
const PEM_END_LINE = "-----END PRIVATE KEY-----";

const rl = readline.createInterface({ input, output });

const applicationAnchor: string = (await rl.question("applicationAnchor: ")).trim();

console.log(
    "\nPaste the application's client-auth private key PEM below.",
);
console.log(
    `(Input ends automatically when a line equal to "${PEM_END_LINE}" is read.)\n`,
);

const pemLines: string[] = [];
for (;;) {

    const line: string = await rl.question("");
    pemLines.push(line);
    if (line.trim() === PEM_END_LINE) break;
}
const privateKeyPem: string = pemLines.join("\n") + "\n";
rl.close();

const client = new ConnectClient({
    baseUrl: CONNECT_BASE_URL,
    clientAuth: {
        applicationAnchor,
        privateKeyPem,
    },
});

console.log("\nCalling /establish ...");
const { exposureKey, hiddenKey } = await client.establish({
    applicationAnchor,
    returnMethods: [{ type: RETURN_METHOD.STATUS_POLL, payload: {} }],
});

const loginUrl = `${LOGIN_UI_BASE}/?exposure-key=${encodeURIComponent(exposureKey)}`;
console.log(`\nOpen this URL in your browser to log in:\n  ${loginUrl}\n`);
console.log("Polling for completion ...");

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

let confirmationKey: string | undefined;
while (confirmationKey === undefined) {

    await wait(POLL_INTERVAL_MS);
    const status = await client.statusPoll({ exposureKey, hiddenKey });
    if (status.status === "REALIZED") {

        confirmationKey = status.confirmationKey;
    }
}

console.log("\nInquiry realized. Calling /redeem ...");
const redeemed = await client.redeem({ exposureKey, hiddenKey, confirmationKey });
const verified = await client.verifyAccessToken(redeemed.accessToken);

console.log(`\n✓ Login successful. subject=${verified.body.subject}`);

// Demonstrate refresh-token rotation. The store would be backed by a
// database row, Redis hash, or cookie jar in a real integration —
// InMemoryTokenStore is fine for a short-lived CLI.
const sessionClient = new SessionClient({ baseUrl: SESSION_BASE_URL });
const rotating = new RotatingSessionClient(sessionClient, new InMemoryTokenStore());
await rotating.seed({
    accessToken: redeemed.accessToken,
    refreshToken: redeemed.refreshToken,
});

console.log("\nCalling /refresh ...");
const rotatedAccessToken: string = await rotating.refresh();
console.log(
    `✓ Rotated. accessToken changed=${rotatedAccessToken !== redeemed.accessToken}`,
);

// Tear the session back down. Possession of the (current, just-rotated)
// refresh token authorizes the revocation, so no client-auth JWT is
// needed. RotatingSessionClient.logout pulls the refresh token out of
// the store and clears the store afterwards.
console.log("\nCalling /logout ...");
await rotating.logout();
console.log("✓ Session revoked.");
