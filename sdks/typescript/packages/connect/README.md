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

Both `redeem` and `refresh` return signed JWTs (RS256). `ConnectClient` exposes convenience verifiers that parse the token, look up the application's public key via `/info` (cached), and verify the signature and expiration.

```typescript
import { ConnectClient } from "@sudomimus/connect";
import { TokenError } from "@sudomimus/token";

const client = new ConnectClient({ baseUrl: "https://connect.sudomimus.com" });

try {
    const token = await client.verifyAccessToken(accessJwt);
    console.log(token.body.accountIdentifier, token.body.firstName);
} catch (err) {
    if (err instanceof TokenError) {
        // err.code: "INVALID_JWT" | "WRONG_KEY_TYPE" | "MISSING_AUDIENCE" | "EXPIRED" | "INVALID_SIGNATURE"
    }
}

const refresh = await client.verifyRefreshToken(refreshJwt);
console.log(refresh.body.accountIdentifier);
```

The public key cache is per-`ConnectClient` instance and keyed by `applicationAnchor` (the JWT's `aud` header). Override the locale used for the cache-populating `/info` call with `new ConnectClient({ baseUrl, publicKeyFetchLocale: "zh-CN" })`. Force a refresh with `client.getApplicationPublicKey(anchor, { force: true })`, or evict entries with `client.clearPublicKeyCache(anchor?)`.

If you only need to verify tokens (you are an application backend and do not drive the auth flow), depend on [`@sudomimus/token`](../token) directly and provide your own `PublicKeyResolver`.

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
