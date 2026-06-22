# @sudomimus/session

TypeScript SDK for the Sudomimus Session API. Use it after an initial login
flow has issued an access/refresh token pair.

```ts
import {
    InMemoryTokenStore,
    RotatingSessionClient,
    SessionClient,
} from "@sudomimus/session";

const session = new RotatingSessionClient(
    new SessionClient(),
    new InMemoryTokenStore(),
);

await session.seed({
    accessToken: redeemed.accessToken,
    refreshToken: redeemed.refreshToken,
});

const accessToken = await session.refresh();
await session.logout();
```

`revokeAll` requires client-auth JWT signing with audience
`sudomimus-session`:

```ts
const client = new SessionClient({
    clientAuth: {
        applicationAnchor: "app_anchor",
        privateKeyPem,
    },
});

await client.revokeAll({ subject: "sector-subject" });
```

Generated request and response types come from
[`specs/session.yaml`](../../../../specs/session.yaml).
