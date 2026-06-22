# Sudomimus Connect — Node example

Minimal CLI demonstrating a full login flow with the
[`@sudomimus/connect`](../../../sdks/typescript/packages/connect),
[`@sudomimus/session`](../../../sdks/typescript/packages/session), and
[`@sudomimus/token`](../../../sdks/typescript/packages/token) SDKs.

The script asks for an `applicationAnchor` and the application's client-auth
private key PEM, then drives establish → status-poll → redeem → refresh →
logout against the Sudomimus production environment.

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
   - A return rule that allows the `STATUS_POLL` return method.

## Run

```bash
pnpm install
pnpm start
```

You will be prompted for:

1. `applicationAnchor:` — paste the anchor string and press Enter.
2. Multi-line PEM private key — paste the full block, ending with the line
   `-----END PRIVATE KEY-----` (the script terminates input automatically when
   it sees that line).

The script then:

- POSTs `/establish` (SDK signs the client-auth JWT for you).
- Prints `https://via.sudomimus.com/?exposure-key=...` — open it in your browser
  and complete the authentication (passkey / email).
- Polls `/status-poll` every 2 seconds.
- Once `REALIZED`, calls `/redeem`, verifies the access token, and prints:

  ```

- Seeds a `RotatingSessionClient` with the returned pair and calls
  `/refresh` once.
- Calls Session `/logout` via the rotating client.
  ✓ Login successful. subject=subject-...
  ```
