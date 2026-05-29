# Sudomimus Connect — Python example

Minimal CLI demonstrating the full login flow with the
[`sudomimus-connect`](../../sdks/python/packages/sudomimus-connect) SDK,
including the 1.0 token-storage and rotation primitives
(`RotatingConnectClient` + `InMemoryTokenStore`).

The script asks for an `applicationAnchor` and the application's client-auth
private key PEM, then drives establish → status-poll → redeem → verify →
refresh → logout against the Sudomimus production environment.

## Prerequisites

1. Python 3.11+ and [`uv`](https://docs.astral.sh/uv/).

2. **Register an application** in the Sudomimus admin console. You need:
   - The `applicationAnchor`.
   - The application's **client-auth private key** in PEM (PKCS#8, RS256).
   - A return rule that allows the `STATUS_POLL` return method.

## Run

From this directory:

```bash
uv sync
uv run python login_example.py
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
  ✓ Login successful. accountIdentifier=acct-...
  ```

- Seeds a `RotatingConnectClient` with the returned pair and calls
  `/refresh` once. The new access token is reported as `changed=True`.
- Calls `/logout` via the rotating client (revokes the refresh token
  server-side and clears the local store).

## How rotation works in this example

`RotatingConnectClient` + `InMemoryTokenStore` enforce the OAuth 2.1 BCP
§4.14.2 strict refresh-token rotation contract: every successful
`refresh()` reads the current refresh token from the store, calls
`/refresh`, and atomically replaces the stored pair with the rotated one
before returning. Concurrent calls on the same instance coalesce onto a
single in-flight request.

For a multi-process server, swap `InMemoryTokenStore` for a Redis- or
DB-backed implementation of the `TokenStore` Protocol — and wrap
`load → /refresh → save` in a cross-process lock so rotations on one
process are visible to the others.
