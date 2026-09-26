# Sudomimus Connect — React and Node example

Vite serves the React UI on `http://localhost:5173`. A small Node backend uses
`@sudomimus/web` for the Connect callback and Session lifecycle. The application
private key, inquiry hidden key, and tokens stay on the backend; the browser
receives only an HttpOnly session cookie and a displayed subject.

## Prerequisites

- Node.js 22+ and pnpm.
- A Sudomimus application with a `CALLBACK` return rule allowing
  `http://localhost:5173/auth/callback`.
- Its application anchor and client-auth private key (PKCS#8 PEM).

Compile the local SDKs before running the example:

```bash
cd ../../../sdks/typescript
pnpm install --frozen-lockfile
pnpm compile
cd ../../examples/typescript/react
pnpm install --frozen-lockfile
```

In one terminal, provide the credentials to the backend and start it:

```bash
export SUDOMIMUS_APPLICATION_ANCHOR='your-anchor'
export SUDOMIMUS_PRIVATE_KEY_PEM="$(cat /path/to/private-key.pem)"
pnpm server
```

In another terminal, run `pnpm dev` from this directory and open
<http://localhost:5173>. Click **Log in**, finish authentication at Sudomimus,
then use **Log out** to revoke the session.

This example uses `MemoryWebAuthStore`, so restarting the backend discards login
state. For deployment, use a shared durable `WebAuthStore` as described in the
[`@sudomimus/web` README](../../../sdks/typescript/packages/web/README.md),
serve the site over HTTPS, and keep the private key in server-side secret
storage. The Node backend here is intended for local development.
