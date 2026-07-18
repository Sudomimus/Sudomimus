# @sudomimus/session

TypeScript SDK for the Sudomimus Session API. Use it after Connect, Device, or
Native has issued an ordinary application access/refresh token pair.

The Session `/refresh` endpoint accepts only `APPLICATION` refresh-token
families. OIDC refresh tokens must use the OIDC `/token` endpoint; passing one
here fails with `401 RefreshTokenInvalidType`.

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
