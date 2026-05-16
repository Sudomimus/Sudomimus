# Contributing to Sudomimus SDKs

Thank you for your interest in contributing. This repository hosts open-source SDKs for the Sudomimus authentication and authorization platform.

## Repository layout

- `specs/` — OpenAPI 3.1 contracts (hand-maintained, one file per public API service)
- `sdks/typescript/` — TypeScript / JavaScript SDKs (pnpm + Turborepo workspace)
- `sdks/python/` — Python SDKs (uv workspace)
- `examples/` — usage examples per language

## Branching and commits

- Work on a feature branch off `main`. Branch names should be short and descriptive (e.g. `feat/connect-redeem`, `fix/python-typing`).
- Commit messages should describe **why**, not just **what**, in one or two sentences.
- All committed content (code, comments, docs, commit messages, PR descriptions) must be written in English.

## TypeScript conventions

Every `.ts` / `.tsx` file must begin with a JSDoc header:

```typescript
/**
 * @author <your name>
 * @package <Human-Readable Package Name>
 * @namespace <CamelCasePath>
 * @description <Filename>
 */
```

Code style:

- Use double quotes and trailing commas.
- One import per line; group imports by scope (`@/...` → scoped → bare → relative), no blank lines between groups.
- Multi-parameter function signatures: one parameter per line with trailing comma, return type on the next line.
- One blank line after the opening `{` of a function or `enum` body. One blank line before a non-leading `return`.

## Python conventions

- `src/` layout for every package.
- Public APIs go through `__init__.py`.
- Type-annotated function signatures.
- Generated models live under `_generated/` and are never edited by hand.

## OpenAPI schema changes

The contracts in `specs/` are the source of truth for SDK type generation. When changing a schema:

1. Edit the spec file (`specs/<service>.yaml`).
2. Regenerate models in every affected SDK (`pnpm generate` in `sdks/typescript`, `uv run task generate` in `sdks/python`).
3. Commit both the spec change and the regenerated files in the same commit.
4. Apply SemVer to the spec: **major** for breaking changes, **minor** for additive changes, **patch** for descriptive-only changes.

CI verifies the generated files match the spec via `git diff --exit-code`.

## Pull request checklist

- [ ] Spec changes regenerated and committed
- [ ] `pnpm lint && pnpm compile && pnpm test` passes in `sdks/typescript`
- [ ] `uv run ruff check && uv run pytest` passes in `sdks/python`
- [ ] README updated if public API changed
- [ ] Status table in root `README.md` updated if package status changed
