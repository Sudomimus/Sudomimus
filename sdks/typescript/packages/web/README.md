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
