# @sudomimus/nextjs

Next.js App Router integration for ordinary Sudomimus Connect login. Configure
`createNextHandlers` once with the same options as `ConnectWeb` in
`@sudomimus/web`, then export its handlers from route files:

```ts
// app/api/login/route.ts
export { start as POST } from "@/sudomimus";

// app/auth/callback/route.ts
export { callback as GET } from "@/sudomimus";

// app/api/logout/route.ts
export { logout as POST } from "@/sudomimus";

// sudomimus.ts (server-only module)
import { createNextHandlers } from "@sudomimus/nextjs";
export const { start, callback, logout, current, currentFromCookieHeader } = createNextHandlers(options);
```

Call `current(request)` in server route handlers, or use
`currentFromCookieHeader((await headers()).get("cookie") ?? "")` in a Server
Component, to get the subject and current access token. Never pass the returned
tokens to a Client Component. Use a shared, durable `WebAuthStore` in production.
The POST handlers check the `Origin` header against the callback origin.
