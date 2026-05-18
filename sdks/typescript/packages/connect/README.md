# @sudomimus/connect

TypeScript SDK for the [Sudomimus](https://sudomimus.com) Connect API — the public entry point for integrating applications. Establish an inquiry, poll for status, redeem for tokens, refresh access tokens, and fetch localized application metadata.

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
    baseUrl: "https://connect.sudomimus.com",
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

    const refreshed = await client.refresh({ refreshToken: tokens.refreshToken });
    console.log(refreshed.accessToken);
}
```

### Verifying issued tokens

Both `redeem` and `refresh` return signed JWTs (RS256). The SDK can parse them, verify their signatures against the application public key (fetched from `/info` and cached), and check expiration.

```typescript
import { ConnectClient, ConnectTokenError } from "@sudomimus/connect";

const client = new ConnectClient({ baseUrl: "https://connect.sudomimus.com" });

try {
    const token = await client.verifyAccessToken(accessJwt);
    console.log(token.body.accountIdentifier, token.body.firstName);
} catch (err) {
    if (err instanceof ConnectTokenError) {
        // err.code: "INVALID_JWT" | "WRONG_KEY_TYPE" | "MISSING_AUDIENCE" | "EXPIRED" | "INVALID_SIGNATURE"
    }
}

const refresh = await client.verifyRefreshToken(refreshJwt);
console.log(refresh.body.accountIdentifier);
```

The public key cache is per-`ConnectClient` instance and keyed by `applicationAnchor` (the JWT's `aud` header). Override the locale used for the cache-populating `/info` call with `new ConnectClient({ baseUrl, publicKeyFetchLocale: "zh-CN" })`. Force a refresh with `client.getApplicationPublicKey(anchor, { force: true })`, or evict entries with `client.clearPublicKeyCache(anchor?)`.

For lower-level access, `parseAccessToken(jwt)` and `parseRefreshToken(jwt)` decode without verifying — they return a `JWTToken` instance (or `null`) so you can inspect headers/body before deciding to verify.

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
    AuthAction,
    AuthActionCallback,
    AuthActionStatusPoll,
    AuthActionSteam,
    ConnectErrorBody,
} from "@sudomimus/connect";
```

Token types (the JWT body and header shapes mirror the server-side definitions):

```typescript
import type {
    AccessToken,
    AccessTokenBody,
    AccessTokenHeader,
    RefreshToken,
    RefreshTokenBody,
    RefreshTokenHeader,
    ConnectTokenErrorCode,
} from "@sudomimus/connect";
```

## License

[MIT](../../../../LICENSE)
