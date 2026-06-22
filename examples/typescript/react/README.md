# Sudomimus Connect — React example

Minimal Vite + React MVP demonstrating the full login flow with the
[`@sudomimus/connect`](../../../sdks/typescript/packages/connect),
[`@sudomimus/session`](../../../sdks/typescript/packages/session), and
[`@sudomimus/token`](../../../sdks/typescript/packages/token) SDKs,
**entirely in the browser**.

> ⚠️ **DEMO ONLY.** This example asks the user to paste the application's
> RS256 private key into a browser textarea. Real integrations must sign the
> `/establish` JWT on a backend — never bundle or accept private keys in
> client code.

## Prerequisites

1. **Compile the local SDK packages** (this example links to local source):

   ```bash
   cd ../../../sdks/typescript
   pnpm install
   pnpm --filter @sudomimus/connect compile
   pnpm --filter @sudomimus/session compile
   cd -
   ```

2. **Register an application** in the Sudomimus admin console. You need:
   - The `applicationAnchor`.
   - The application's **client-auth private key** in PEM (PKCS#8, RS256).
   - A `CALLBACK` return rule whose allowed callback domain includes
     `http://localhost:5173` (the Vite dev server URL).

## Run

```bash
pnpm install
pnpm dev
```

Open <http://localhost:5173>.

1. Paste the `applicationAnchor`.
2. Paste the full PEM private key (`-----BEGIN PRIVATE KEY-----` ... `-----END PRIVATE KEY-----`).
3. Click **Login**.
4. You'll be redirected to `via.sudomimus.com` to authenticate (passkey or
   email).
5. The login UI redirects you back to `http://localhost:5173/?exposure-key=...&confirmation-key=...`.
6. The page calls `/redeem`, decodes the access token, seeds a
   `RotatingSessionClient`, calls Session `/refresh`, and renders the
   logged-in user (`subject`, `firstName`, `lastName?`).

## How it works

- The SDK's `ConnectClient.establish()` signs a client-auth JWT (RS256) and
  attaches it as `Authorization: SudomimusClientJWT <jwt>`.
- The `hiddenKey` returned by `/establish` is stashed in `sessionStorage`
  keyed by `exposureKey` so it survives the redirect roundtrip.
- On the callback landing, the Connect SDK client calls `/redeem`, then the
  Session SDK owns `/refresh` and `/logout` using the returned refresh token.

## Why a BYO signer?

The SDK's built-in `signEstablishClientJwt` helper uses Node's
`crypto.createSign`. Browsers don't ship that API, so this example passes
its own `clientAuth.signer` to `ConnectClient` — see
[`src/browser-signer.ts`](./src/browser-signer.ts) — which constructs and
signs the JWT using the Web Crypto API (`SubtleCrypto`) instead. The
unused Node `crypto` import inside the SDK is aliased to a stub in
[`vite.config.ts`](./vite.config.ts) so Vite still resolves the import
even though it's never executed.

For the same reason, this demo decodes the access token's body inline
without verifying its signature. Production code should verify access
tokens on a backend (or via SubtleCrypto), never trust an unverified
client-side decode for security decisions.
