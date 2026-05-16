# @sudomimus/native

TypeScript SDK for the Sudomimus Native API — the public gateway used by native clients (desktop applications, games) to authenticate through an external browser.

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
    baseUrl: "https://native.sudomimus.com",
});
```

## Types

Request, response, and error types are generated from [`specs/native.yaml`](../../../../specs/native.yaml) and re-exported by name:

```typescript
import type {
    StatusPollRequest,
    StatusPollResponse,
    NativeError,
} from "@sudomimus/native";
```

## License

[MIT](../../../../LICENSE)
