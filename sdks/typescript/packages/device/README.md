# @sudomimus/device

TypeScript SDK for the Sudomimus Device API: public-client device authorization
via `/device-authorize` and `/device-token`.

The Device API does not refresh tokens itself. A successful `/device-token`
returns a normal Sudomimus access/refresh pair; use `@sudomimus/session` for
later `/refresh`, `/logout`, `/introspect`, and `/revoke-all`.

## Manual polling and manual storage

```ts
import { DeviceClient, DeviceTokenApiError } from "@sudomimus/device";

const client = new DeviceClient({ baseUrl: "https://device-api.sudomimus.com" });
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

```ts
import { InMemoryTokenStore, RotatingSessionClient, SessionClient } from "@sudomimus/session";
import { DeviceAuthenticator, DeviceClient } from "@sudomimus/device";

const store = new InMemoryTokenStore();
const device = new DeviceClient({ baseUrl: "https://device-api.sudomimus.com" });
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
