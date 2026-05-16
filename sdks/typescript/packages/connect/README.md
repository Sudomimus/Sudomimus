# @sudomimus/connect

TypeScript SDK for the Sudomimus Connect API — token exchange (Establish, Redeem, Refresh).

## Install

```bash
npm install @sudomimus/connect
# or
pnpm add @sudomimus/connect
```

## Usage

```typescript
import { ConnectClient } from "@sudomimus/connect";

const client = new ConnectClient({
    baseUrl: "https://connect.sudomimus.com",
});
```

## Types

Request, response, and error types are generated from [`specs/connect.yaml`](../../../../specs/connect.yaml) and re-exported by name:

```typescript
import type {
    EstablishRequest,
    EstablishResponse,
    RedeemRequest,
    RefreshRequest,
    TokenPair,
    ConnectError,
} from "@sudomimus/connect";
```

## License

[MIT](../../../../LICENSE)
