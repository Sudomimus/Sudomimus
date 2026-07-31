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

The client can also verify issued tokens through the Session JWKS endpoint:

```ts
const verified = await client.verifyAccessToken(redeemed.accessToken);
console.log(verified.body.subject, verified.header.kid);
```

JWKS responses honor `Cache-Control: max-age` (with a 5-minute fallback). If a
token references an unknown `kid`, the client refreshes JWKS once before
returning `UNKNOWN_KEY_ID`.

Generated request and response types come from
[`specs/session.yaml`](../../../../specs/session.yaml).
