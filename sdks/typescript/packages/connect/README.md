# @sudomimus/connect

TypeScript SDK for the Sudomimus Connect API. Connect owns the initial browser
inquiry lifecycle:

- `establish`
- `statusPoll`
- `redeem`
- `info`

Use [`@sudomimus/session`](../session) after `redeem` for `/refresh`,
`/introspect`, `/logout`, and `/revoke-all`.

```typescript
import { ConnectClient, RETURN_METHOD } from "@sudomimus/connect";

const client = new ConnectClient({
    clientAuth: {
        applicationAnchor: "your-app-anchor",
        privateKeyPem,
    },
});

const inquiry = await client.establish({
    applicationAnchor: "your-app-anchor",
    returnMethods: [{ type: RETURN_METHOD.STATUS_POLL, payload: {} }],
});

const status = await client.statusPoll({
    exposureKey: inquiry.exposureKey,
    hiddenKey: inquiry.hiddenKey,
});

if (status.status === "REALIZED") {
    const tokens = await client.redeem({
        exposureKey: inquiry.exposureKey,
        hiddenKey: inquiry.hiddenKey,
        confirmationKey: status.confirmationKey,
    });
    console.log(tokens.accessToken, tokens.refreshToken, tokens.claims);
}
```

`/establish` requires a client-auth JWT with audience `sudomimus-connect`.
Pass `clientAuth` to let the SDK sign it, or provide a BYO signer.

`ConnectClient` also exposes `verifyAccessToken` and `verifyRefreshToken`,
which resolve the application's public key through `/info` and cache it per
client instance. If you only need JWT verification, depend on
[`@sudomimus/token`](../token) directly.

Generated request and response types come from
[`specs/connect.yaml`](../../../../specs/connect.yaml).
