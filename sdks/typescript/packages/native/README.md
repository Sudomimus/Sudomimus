# @sudomimus/native

TypeScript SDK for the [Sudomimus](https://sudomimus.com) Native API — the direct-issue gateway for native clients (desktop apps, games, headless processes). The client presents a platform-issued proof (a Steam Web API auth ticket) or a long-lived access-key credential and receives application access + refresh tokens in a single round trip. No browser handoff, no inquiry establishment, no polling.

## Install

```bash
npm install @sudomimus/native
# or
pnpm add @sudomimus/native
```

## Usage

```typescript
import { NativeClient } from "@sudomimus/native";

const client = new NativeClient({
    baseUrl: "https://native-api.sudomimus.com",
});
```

### Steam ticket

Acquire the ticket via Steamworks, hex-encode the bytes, and exchange it for tokens. The identity string passed to `GetAuthTicketForWebApi` MUST be exactly `"sudomimus"` — exported as `STEAM_TICKET_IDENTITY`.

```typescript
import { NativeClient, STEAM_TICKET_IDENTITY } from "@sudomimus/native";

// 1. ISteamUser::GetAuthTicketForWebApi(STEAM_TICKET_IDENTITY)
// 2. Wait for the GetTicketForWebApiResponse_t callback.
// 3. Hex-encode the ticket bytes.

const tokens = await client.directIssueSteamTicket({
    applicationAnchor: "your-app-anchor",
    steamTicketHex: "deadbeef...",
    steamAppId: 480,
});

console.log(tokens.accessToken, tokens.refreshToken);
```

### Access key

Trade an access-key credential (issued in the admin console) for tokens. Intended for long-lived headless callers — CI runners, server-to-server scripts, automation.

```typescript
const tokens = await client.directIssueAccessKey({
    applicationAnchor: "your-app-anchor",
    accessKeyIdentifier: "01890c5e-1234-4abc-9def-0123456789ab",
    accessKeySecret: "<64-char lowercase hex secret>",
});
```

### Renewing tokens

The issued tokens share the shape of those minted by Connect's `/redeem`. Use [`@sudomimus/connect`](../connect)'s `/refresh` to renew the access token without re-presenting a Steam ticket or access key, and [`@sudomimus/token`](../token) to verify the issued JWTs.

### Error handling

All non-2xx HTTP responses surface as `NativeApiError`:

```typescript
import { NativeApiError } from "@sudomimus/native";

try {
    await client.directIssueAccessKey({ /* ... */ });
} catch (err) {
    if (err instanceof NativeApiError) {
        console.error(err.status, err.reason);
    }
}
```

The Native service returns `{ "reason": "<code>" }` for known failures. All access-key credential failures collapse into an opaque `401 AccessKeyDirectDenied`; three-layer rule rejections surface as `403` with `Layer1Denied` / `Layer2Denied` / `Layer3Denied`; a replayed Steam ticket returns `409`. For `PRIVATE_*` symbols the body is empty — in that case `err.reason` and `err.body` are both `undefined` and only `err.status` carries signal.

## Claims & errand recovery

Every direct-issue response carries a `claims` view — the per-claim policy joined with the user's standing decision — so you can tell why a claim is or isn't in the minted token (`OFF` / `UNKNOWN` / `DENIED` / granted):

```typescript
const tokens = await client.directIssueAccessKey({ /* ... */ });
// tokens.claims.email.requirement -> "OFF" | "OPTIONAL" | "REQUIRED"
// tokens.claims.email.state       -> "UNKNOWN" | "GRANTED" | "DENIED"
```

When an application **requires** a claim the user hasn't granted (or the account lacks the data), direct-issue can't prompt — it throws a `403` whose body carries an **errand** handoff: a short-lived browser URL where the user grants consent / completes the data. Open it, poll `errandStatus`, then retry:

```typescript
try {
    return await client.directIssueAccessKey(request);
} catch (err) {
    if (err instanceof NativeApiError && err.body?.errand) {
        // Open err.body.errand.url in the user's browser (consent / data entry).
        // err.body.claims tells you what is still owed.
        let status = "PENDING";
        while (status === "PENDING") {
            await sleep(2000);
            ({ status } = await client.errandStatus(err.body.errand.errandKey));
        }
        if (status === "COMPLETED") {
            return await client.directIssueAccessKey(request); // retry once
        }
    }
    throw err;
}
```

`errandStatus` is a pure read (safe to poll every ~2s); unknown/expired keys report `EXPIRED`. A retried direct-issue re-hands the same `errandKey` while the ticket has ≥ 15 min left, so polling state never splits.

## Types

HTTP request, response, and error types are generated from [`specs/native.yaml`](../../../../specs/native.yaml) and re-exported by name:

```typescript
import type {
    DirectIssueSteamTicketRequest,
    DirectIssueSteamTicketResponse,
    DirectIssueAccessKeyRequest,
    DirectIssueAccessKeyResponse,
    ClaimsStateView,
    ClaimRequirementStateView,
    ErrandHandoff,
    ErrandStatusResponse,
    DirectIssueDeniedError,
    NativeErrorBody,
} from "@sudomimus/native";
```

## License

[MIT](../../../../LICENSE)
