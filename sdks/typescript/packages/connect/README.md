# @sudomimus/connect

TypeScript SDK for the [Sudomimus](https://sudomimus.com) Connect API — the public entry point for integrating applications. Establish an inquiry, poll for status, redeem for tokens, refresh access tokens, fetch localized application metadata, introspect a session's revocation status, and revoke sessions (one via `/logout` or all of an account's via `/revoke-all`).

## Install

```bash
npm install @sudomimus/connect
# or
pnpm add @sudomimus/connect
```

## Usage

```typescript
import { ConnectClient, ConnectApiError } from "@sudomimus/connect";

const client = new ConnectClient({
    baseUrl: "https://connect-api.sudomimus.com",
});

const inquiry = await client.establish({
    applicationAnchor: "your-app-anchor",
    actions: [
        { type: "CALLBACK", payload: { callbackUrl: "https://your-app.example.com/cb" } },
    ],
});

const poll = await client.statusPoll({
    exposureKey: inquiry.exposureKey,
    hiddenKey: inquiry.hiddenKey,
});

if (poll.status === "REALIZED") {

    const tokens = await client.redeem({
        exposureKey: inquiry.exposureKey,
        hiddenKey: inquiry.hiddenKey,
        confirmationKey: poll.confirmationKey,
    });

    // `/refresh` rotates the refresh token (OAuth 2.1 BCP §4.14.2 strict
    // mode): every call returns BOTH a new access token AND a new refresh
    // token, and invalidates the one you presented. Replace your stored
    // refresh token with `refreshed.refreshToken` before the next call —
    // or use `RotatingConnectClient` (below), which handles this for you.
    const refreshed = await client.refresh({ refreshToken: tokens.refreshToken });
    console.log(refreshed.accessToken);
    console.log(refreshed.refreshToken);
}
```

### Token storage contract (read this before shipping refresh)

The Connect API does **OAuth 2.1 BCP §4.14.2 strict refresh-token rotation**: every `/refresh` returns a new pair AND invalidates the refresh token you presented. Re-presenting an already-rotated refresh token (or losing the rotation race to a concurrent caller) is treated as evidence of compromise — the server revokes the entire refresh-token family and the user must re-authenticate from scratch.

In practice this means **every successful `/refresh` MUST atomically replace your persisted refresh token** with the new one before any other code can read the old one. The bare `ConnectClient` does not do this for you — it is a stateless HTTP wrapper. Two options:

**Option 1 — use `RotatingConnectClient`** (recommended for most servers):

```typescript
import {
    ConnectClient,
    InMemoryTokenStore,
    RotatingConnectClient,
} from "@sudomimus/connect";

const connect = new ConnectClient({ baseUrl: "https://connect-api.sudomimus.com" });

// One store per session. Swap InMemoryTokenStore for a Redis-/DB-backed
// implementation of the `TokenStore` interface in production.
const session = new RotatingConnectClient(connect, new InMemoryTokenStore());

await session.seed(tokensFromRedeem);     // persist initial pair
const access = await session.getAccessToken();
const next   = await session.refresh();   // rotates, persists, returns new access token
await session.logout();                   // best-effort /logout + clear store
```

`RotatingConnectClient` also coalesces concurrent `refresh()` calls on the same instance onto a single in-flight `/refresh`, which avoids tripping `RefreshTokenRotationRaceLost` when many requests fire simultaneously. **Cross-process** races still need an external lock (Redis `SETNX`, a DB row lock) wrapping `load → /refresh → save`.

**Option 2 — implement the bookkeeping yourself.** If you do, the contract is: between the moment you read the current refresh token and the moment you persist the new pair, no other code path may read the old token. Any partial write (new access stored, new refresh dropped) desynchronises you from the server and the next `/refresh` will trip `RefreshTokenFamilyCompromised`.

### Verifying issued tokens

Both `redeem` and `refresh` return signed JWTs (RS256). `ConnectClient` exposes convenience verifiers that parse the token, look up the application's public key via `/info` (cached), and verify the signature and expiration.

```typescript
import { ConnectClient } from "@sudomimus/connect";
import { TokenError } from "@sudomimus/token";

const client = new ConnectClient({ baseUrl: "https://connect-api.sudomimus.com" });

try {
    const token = await client.verifyAccessToken(accessJwt);
    console.log(token.body.subject, token.body.firstName);
} catch (err) {
    if (err instanceof TokenError) {
        // err.code: "INVALID_JWT" | "WRONG_KEY_TYPE" | "MISSING_AUDIENCE" | "EXPIRED" | "INVALID_SIGNATURE"
    }
}

const refresh = await client.verifyRefreshToken(refreshJwt);
console.log(refresh.body.subject);
```

The public key cache is per-`ConnectClient` instance and keyed by `applicationAnchor` (the JWT's `aud` header). Override the locale used for the cache-populating `/info` call with `new ConnectClient({ baseUrl, publicKeyFetchLocale: "zh-CN" })`. Force a refresh with `client.getApplicationPublicKey(anchor, { force: true })`, or evict entries with `client.clearPublicKeyCache(anchor?)`.

If you only need to verify tokens (you are an application backend and do not drive the auth flow), depend on [`@sudomimus/token`](../token) directly and provide your own `PublicKeyResolver`.

### Sessions: introspect, logout, revoke

```typescript
// Near-real-time revocation check for a session behind an access token.
// The token is self-authenticating (signature verified server-side); its own
// expiry is NOT enforced here. Cache the answer for recommendedRecheckSeconds.
const { status, recommendedRecheckSeconds } = await client.introspect({ accessToken });
if (status !== "active") {
    // status is one of "active" | "revoked" | "expired" | "not_found"
}

// Revoke a single session. Possession of the refresh token authorizes it, so
// no client-auth JWT is required. Idempotent: already-revoked tokens report
// revoked: true; unresolvable tokens report revoked: false.
await client.logout({ refreshToken });

// Revoke every session of an account for the calling application
// ("log out everywhere"). This is an application-authority action, so — like
// establish — it requires a clientAuth config on the ConnectClient.
const { revokedCount } = await client.revokeAll({ subject: "subject-1" });
```

### Error handling

All non-2xx HTTP responses surface as `ConnectApiError`:

```typescript
try {
    await client.establish({ applicationAnchor: "missing", actions: [] });
} catch (err) {
    if (err instanceof ConnectApiError) {
        console.error(err.status, err.reason);
    }
}
```

The Connect service returns `{ "reason": "<code>" }` for known failures. For `PRIVATE_*` symbols the body is empty — in that case `err.reason` and `err.body` are both `undefined` and only `err.status` carries signal.

## Types

HTTP request, response, and error types are generated from [`specs/connect.yaml`](../../../../specs/connect.yaml) and re-exported by name:

```typescript
import type {
    HealthResponse,
    EstablishRequest,
    EstablishResponse,
    StatusPollRequest,
    StatusPollResponse,
    StatusPollPendingResponse,
    StatusPollRealizedResponse,
    RedeemRequest,
    RedeemResponse,
    RefreshRequest,
    RefreshResponse,
    InfoRequest,
    InfoResponse,
    IntrospectRequest,
    IntrospectResponse,
    LogoutRequest,
    LogoutResponse,
    RevokeAllRequest,
    RevokeAllResponse,
    AuthAction,
    AuthActionCallback,
    AuthActionStatusPoll,
    AuthActionSteam,
    ConnectErrorBody,
} from "@sudomimus/connect";
```

Token types (the JWT body and header shapes mirror the server-side definitions) live in [`@sudomimus/token`](../token):

```typescript
import type {
    AccessToken,
    AccessTokenBody,
    AccessTokenHeader,
    RefreshToken,
    RefreshTokenBody,
    RefreshTokenHeader,
    TokenErrorCode,
} from "@sudomimus/token";
```

## License

[MIT](../../../../LICENSE)
