# Repository Instructions

## Project layout

- `sdks/` contains the TypeScript (pnpm), Python (uv), C# (.NET), Go, and Java client SDKs.
- `examples/` contains SDK usage examples; `docs/` contains guides and publishing documentation.
- `specs/` is the OpenAPI contract submodule. `.github/workflows/` contains CI and package publishing workflows; the root `Makefile` provides local commands.

## Sources of truth

- Follow `CONTRIBUTING.md` and `.agents/common-skills-policy.md`. For audit work, also follow `.agents/audit-policy.md`.
- Treat the OpenAPI contracts in `specs/` as the source of truth for generated SDK models and types. Regenerate those files with the repository's tools; do not edit generated output by hand.

## Scope and validation

- Preserve unrelated work in the checkout. Do not modify the `specs/` submodule or the separate core monorepo unless the user explicitly includes them in the task.
- Use the relevant `Makefile` targets and `.github/workflows/ci-*.yml` for validation. There is no single full-repository validation command.
- When changing an SDK interface, check its direct consumers and relevant examples.

## Git commits and pushes

- Do not commit changes unless the user explicitly authorizes a commit.
- Do not push changes unless the user explicitly authorizes a push. Permission to commit does not imply permission to push.
- Requests to implement, fix, or validate work do not authorize either action. Leave changes uncommitted by default.
- Do not publish packages or trigger deployments unless the user explicitly authorizes that action.
