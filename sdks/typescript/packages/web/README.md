# @sudomimus/web

Server-side Connect login and application-session lifecycle. `ConnectWeb` provides
`start`, `callback`, `current`, and `logout` methods using Web `Request`/`Response`.
The browser receives only opaque cookie IDs. `hiddenKey`, access tokens, and
refresh tokens stay in `WebAuthStore`.

```ts
import { ConnectClient } from "@sudomimus/connect";
import { SessionClient } from "@sudomimus/session";
import { ConnectWeb, MemoryWebAuthStore } from "@sudomimus/web";

const web = new ConnectWeb({
  applicationAnchor: "my-app",
  callbackUrl: "https://my-app.example/auth/callback",
  afterLoginUrl: "/dashboard",
  afterLogoutUrl: "/",
  connect: new ConnectClient({ clientAuth: { applicationAnchor: "my-app", privateKeyPem } }),
  session: new SessionClient(),
  store: new MemoryWebAuthStore(), // development only
});
```

The callback URL must be permitted by the application's CALLBACK ReturnRule.
`start` and `logout` require POST with an `Origin` equal to the callback origin.
Implement `WebAuthStore` on a shared database or Redis for production;
`takePending` must be atomic, and `withSession` must serialize refreshes for the
same session across all instances. Set its session TTL no longer than the
underlying Sudomimus refresh-session lifetime. `current` returns credentials for
server use only; never serialize its result into a client component or page.

When redemption requires Basic Terms or current claim consent, or the
Inquiry's identity authority is stale, the callback clears the pending cookie
and redirects to `reauthenticationUrl`. It defaults to `afterLogoutUrl`.
Serve a sign-in page there with a form that POSTs to `start`. When refresh
requires Basic Terms, `current` returns `undefined` and marks the saved
session as requiring reauthentication. Its refresh token stays in the
server-side store so `logout` can still revoke the session.
