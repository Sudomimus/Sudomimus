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

### Error handling

All non-2xx responses surface as `ConnectApiError`:

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

Request, response, and error types are generated from [`specs/connect.yaml`](../../../../specs/connect.yaml) and re-exported by name:

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

## License

[MIT](../../../../LICENSE)
