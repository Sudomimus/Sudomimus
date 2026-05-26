# Sudomimus TypeScript SDKs

This workspace hosts the TypeScript / JavaScript SDKs published to npm under the [`@sudomimus`](https://www.npmjs.com/org/sudomimus) scope.

## Packages

| Package | Spec | Purpose |
| --- | --- | --- |
| [`@sudomimus/connect`](packages/connect) | [`specs/connect.yaml`](../../specs/connect.yaml) | Token exchange (Establish / StatusPoll / Redeem / Refresh / Info / Introspect / Logout / RevokeAll) |
| [`@sudomimus/token`](packages/token) | — | Parse and verify Sudomimus access / refresh JWTs |
| [`@sudomimus/native`](packages/native) | [`specs/native.yaml`](../../specs/native.yaml) | Direct-issue (Steam ticket / access key) |

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
