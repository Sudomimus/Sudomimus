/** Public-client device login: no application private key is needed. */
import { DeviceAuthenticator, DeviceClient } from "@sudomimus/device";
import { InMemoryTokenStore, RotatingSessionClient, SessionClient } from "@sudomimus/session";
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const input = readline.createInterface({ input: stdin, output: stdout });
const applicationAnchor = (await input.question("applicationAnchor: ")).trim();
input.close();
if (!applicationAnchor) throw new Error("applicationAnchor is required");

const store = new InMemoryTokenStore();
const authenticator = new DeviceAuthenticator(new DeviceClient(), { store });
const result = await authenticator.authorizeAndPoll(
    { applicationAnchor },
    {
        onAuthorize: (authorization) => {
            console.log(`Open ${authorization.verificationUriComplete}`);
            console.log(`Enter code: ${authorization.userCode}`);
        },
        onPoll: ({ error, nextIntervalSeconds }) => {
            console.log(`${error}; checking again in ${nextIntervalSeconds}s`);
        },
    },
);

console.log("Device authorized. Access and refresh tokens were stored locally.");
const rotating = new RotatingSessionClient(new SessionClient(), store);
const refreshed = await rotating.refresh();
console.log(`Session refreshed: ${refreshed !== result.tokens.accessToken}`);
await rotating.logout();
console.log("Logged out; local tokens cleared.");
