# @sudomimus/react-router

React Router Framework Mode integration for ordinary Connect login.

```ts
// app/sudomimus.server.ts
import { createReactRouterHandlers } from "@sudomimus/react-router";
export const sudomimus = createReactRouterHandlers(options);

// app/routes/login.tsx
export const action = sudomimus.startAction;

// app/routes/auth.callback.tsx
export const loader = sudomimus.callbackLoader;

// app/routes/logout.tsx
export const action = sudomimus.logoutAction;
```

Use `sudomimus.current({ request })` in server loaders/actions. Configure a
shared `WebAuthStore` and CSRF protection for the POST actions in production.
