# Contributing to Sudomimus SDKs

Thank you for your interest in contributing. This repository hosts open-source SDKs for the Sudomimus authentication and authorization platform.

## Repository layout

- `specs/` — OpenAPI 3.1 contracts, a git submodule tracking [`sudomimus/sudomimus-spec`](https://github.com/sudomimus/sudomimus-spec) (one file per public API service)
- `sdks/typescript/` — TypeScript / JavaScript SDKs (pnpm + Turborepo workspace)
- `sdks/python/` — Python SDKs (uv workspace)
- `sdks/csharp/` — C# / .NET 8 SDKs (dotnet solution, NuGet packages)
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

## C# conventions

- One project per published NuGet package under `sdks/csharp/src/<PackageName>/`, matching tests under `sdks/csharp/tests/<PackageName>.Tests/`.
- Target framework, language version, nullable-reference-types setting, and other shared build properties live in `sdks/csharp/Directory.Build.props` — do not override them per-project unless there is a documented reason.
- Public surface mirrors the equivalent TypeScript SDK (`@sudomimus/native` ↔ `Sudomimus.Native`, `@sudomimus/token` ↔ `Sudomimus.Token`); when one language's surface changes, plan the equivalent change in the other.

## OpenAPI schema changes

The contracts in `specs/` are the source of truth for SDK type generation. They
live in the [`sudomimus/sudomimus-spec`](https://github.com/sudomimus/sudomimus-spec)
submodule, so a schema change spans two repositories. When changing a schema:

1. Edit the spec file inside the submodule (`specs/<service>.yaml`), then commit
   and push it from the `sudomimus-spec` repository. Apply SemVer to the spec:
   **major** for breaking changes, **minor** for additive changes, **patch** for
   descriptive-only changes.
2. In this repository, bump the submodule pointer to the new spec commit
   (`git -C specs pull` to advance it, then `git add specs`).
3. Regenerate models in every affected SDK (`pnpm generate` in `sdks/typescript`,
   `uv run python tasks.py generate` in `sdks/python`). The C# SDKs do not
   currently generate from the spec — update hand-written models if the spec
   change touches a surface that `Sudomimus.Native` or `Sudomimus.Token`
   exposes.
4. Commit the submodule pointer bump and the regenerated files in the same commit.

CI verifies the generated files match the spec via `git diff --exit-code`.

## Pull request checklist

- [ ] Spec changes regenerated and committed
- [ ] `pnpm lint && pnpm compile && pnpm test` passes in `sdks/typescript`
- [ ] `uv run ruff check && uv run mypy packages/sudomimus-token/src packages/sudomimus-native/src packages/sudomimus-connect/src && uv run pytest` passes in `sdks/python`
- [ ] `dotnet build sdks/csharp/Sudomimus.slnx -c Release && dotnet test sdks/csharp/Sudomimus.slnx -c Release` passes (or use `make compile-csharp test-csharp`)
- [ ] README updated if public API changed
- [ ] Status table in root `README.md` updated if package status changed
