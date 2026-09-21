# Sudomimus TypeScript SDKs

This workspace hosts the TypeScript / JavaScript SDKs published to npm under the [`@sudomimus`](https://www.npmjs.com/org/sudomimus) scope.

## Packages

| Package | Spec | Purpose |
| --- | --- | --- |
| [`@sudomimus/connect`](packages/connect) | [`specs/connect.yaml`](../../specs/connect.yaml) | Inquiry lifecycle (Establish / StatusPoll / Redeem / Info) |
| [`@sudomimus/device`](packages/device) | [`specs/device.yaml`](../../specs/device.yaml) | Device authorization for public clients (DeviceAuthorize / DeviceToken) |
| [`@sudomimus/token`](packages/token) | — | Parse and verify Account / Workload access and refresh JWTs |
| [`@sudomimus/native`](packages/native) | [`specs/native.yaml`](../../specs/native.yaml) | Direct-issue (Steam / access key / public key) |
| [`@sudomimus/session`](packages/session) | [`specs/session.yaml`](../../specs/session.yaml) | Session lifecycle (Refresh / Introspect / Logout / RevokeAll) |

## Framework integrations

These packages use the ordinary Connect callback and Session APIs. They are not OIDC clients.

| Package | Purpose |
| --- | --- |
| [`@sudomimus/web`](packages/web) | Shared server-side login/session core and storage contract |
| [`@sudomimus/nextjs`](packages/nextjs) | Next.js App Router handlers |
| [`@sudomimus/react-router`](packages/react-router) | React Router Framework Mode loaders/actions |
| [`@sudomimus/nuxt`](packages/nuxt) | Nuxt server routes on the Node/Nitro preset |

## Tooling

- [pnpm](https://pnpm.io) workspaces
- [Turborepo](https://turborepo.com) task pipeline
- TypeScript 5.x, ESM output
- ESLint flat config
- Jest with `ts-jest`
- [`openapi-typescript`](https://openapi-ts.dev) for generating models from the OpenAPI specs in `../../specs/`

## Develop

```bash
cd sdks/typescript
pnpm install
pnpm generate     # regenerate packages/*/src/_generated/schema.ts from the specs
pnpm compile      # tsc per package, emits dist/
pnpm lint
pnpm test
pnpm coverage     # jest --coverage per package
```

Generated files live in `packages/*/src/_generated/` and are checked in. After editing a spec, run `pnpm generate` and commit the regenerated files.
