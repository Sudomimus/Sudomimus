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

## Types

HTTP request, response, and error types are generated from [`specs/native.yaml`](../../../../specs/native.yaml) and re-exported by name:

```typescript
import type {
    DirectIssueSteamTicketRequest,
    DirectIssueSteamTicketResponse,
    DirectIssueAccessKeyRequest,
    DirectIssueAccessKeyResponse,
    NativeErrorBody,
} from "@sudomimus/native";
```

## License

[MIT](../../../../LICENSE)
