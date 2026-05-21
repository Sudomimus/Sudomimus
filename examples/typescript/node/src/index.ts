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
 *   7. Print the accountIdentifier as the "login succeeded" signal.
 */

import { ConnectClient, RETURN_METHOD } from "@sudomimus/connect";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const CONNECT_BASE_URL = "https://connect-api.sudomimus.com";
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
const { accessToken } = await client.redeem({ exposureKey, hiddenKey, confirmationKey });
const verified = await client.verifyAccessToken(accessToken);

console.log(`\n✓ Login successful. accountIdentifier=${verified.body.accountIdentifier}`);
