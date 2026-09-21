# @sudomimus/nuxt

Nuxt server route integration for ordinary Connect login. This adapter targets
the Node/Nitro preset.

```ts
// server/utils/sudomimus.ts
import { createNuxtHandlers } from "@sudomimus/nuxt";
export const sudomimus = createNuxtHandlers(options);

// server/api/login.post.ts
export default defineEventHandler((event) => sudomimus.start(event));

// server/routes/auth/callback.get.ts
export default defineEventHandler((event) => sudomimus.callback(event));

// server/api/logout.post.ts
export default defineEventHandler((event) => sudomimus.logout(event));
```

Use `sudomimus.current(event)` in server handlers only. Configure a shared
`WebAuthStore` and CSRF protection for the POST routes in production.
