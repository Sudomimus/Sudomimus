# @sudomimus/device

TypeScript SDK for the Sudomimus Device API: public-client device authorization
via `/device-authorize` and `/device-token`.

The Device API does not refresh tokens itself. A successful `/device-token`
returns a normal Sudomimus access/refresh pair; use `@sudomimus/session` for
later `/refresh`, `/logout`, `/introspect`, and `/revoke-all`.

`deviceAuthorize` may reject admission with a bodyless `429` when creation
budgets are exhausted or a bodyless `503` when admission counters are
unavailable. Both surface as `DeviceApiError` with an undefined `reason` and
`body`; back off before retrying.

## Browser approval

The client validates both verification URLs before returning authorization
details to display or open. Use HTTPS or loopback HTTP for local development
on `localhost`, `127.0.0.1`, or `[::1]`. If the server ends polling with
`access_denied`, a new browser authorization is required to try again. This
includes approval recorded before the account accepted the current Basic
Terms.

## Manual polling and manual storage

```ts
import { DeviceClient, DeviceTokenApiError } from "@sudomimus/device";

const client = new DeviceClient();
const auth = await client.deviceAuthorize({ applicationAnchor: "my-app" });

console.log(auth.userCode, auth.verificationUriComplete);

while (true) {
    try {
        const tokens = await client.deviceToken({ deviceCode: auth.deviceCode });
        // Persist tokens.accessToken / tokens.refreshToken yourself.
        break;
    } catch (error) {
        if (
            error instanceof DeviceTokenApiError
            && (error.error === "authorization_pending" || error.error === "slow_down")
        ) {
            await new Promise((resolve) => setTimeout(resolve, (error.interval ?? auth.interval) * 1000));
            continue;
        }
        throw error;
    }
}
```

## Automatic polling with Connect-compatible storage

Automatic polling waits for the returned interval before the first exchange.
The authorization lifetime starts when the client receives the authorization
response. It counts the time spent displaying the code or opening the browser.
A request that is already in flight can still finish when the polling deadline
passes. Cancel with the option `signal` to abort the request. A result that
arrives after cancellation is discarded.

```ts
import { InMemoryTokenStore, RotatingSessionClient, SessionClient } from "@sudomimus/session";
import { DeviceAuthenticator, DeviceClient } from "@sudomimus/device";

const store = new InMemoryTokenStore();
const device = new DeviceClient();
const auth = new DeviceAuthenticator(device, {
    store,
    openUrl: (url) => console.log("Open:", url),
});

const result = await auth.authorizeAndPoll({ applicationAnchor: "my-app" });
console.log(result.tokens.accessToken);

// Later refresh/logout through Session using the same store.
const session = new SessionClient();
const rotating = new RotatingSessionClient(session, store);
const accessToken = await rotating.refresh();
```

[Package release history](.changeset/history/)
