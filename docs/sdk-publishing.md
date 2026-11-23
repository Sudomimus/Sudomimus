# SDK publishing

## TypeScript SDKs

Use Node 26 from `sdks/typescript/.nvmrc` and the pnpm version in
`sdks/typescript/package.json`. Run Make commands from the repository root.
The TypeScript workspace discovers public SDKs and framework integrations under
`sdks/typescript/packages/*`. Each package owns its semantic version.

### Preparing versions

1. Record an English release note with `make changeset`. For a scripted note,
   use `make changeset TARGET=packages/token BUMP=patch SUMMARY="Describe the SDK change."`.
   One Markdown note in `sdks/typescript/.changeset/` may specify multiple workspace
   paths with individual bumps. Tooling-only changes need no package release.
2. Run `make version-dry-run ARGS=--verbose` to review versions before writing.
   The highest requested bump wins per package. Exact runtime `workspace:*`
   dependencies propagate patch releases through consumers. Caret ranges propagate
   when the new version is outside the published range. The planner skips the
   SDK's reserved uniform and staircase digit versions.
3. Run `make version-packages` to update manifests, consume pending notes, and
   write each affected package's UTC-quarter `.changeset/history/YYYY-QN/CHANGELOG.md`
   and `ledger.yaml`. The ledger records the previous version, bump, date, and note
   digests. Dependency-only changes are described in the changelog. The migration
   baseline records the existing manifest version and starts with an empty ledger.
   Review the manifests, notes and histories together. If a process terminates
   during application, inspect the working files before clearing its abandoned
   `.changeset/.version-lock` directory.

### Validating and publishing

`make validate-typescript` checks release plans, workflow conventions, tooling,
lint, compilation, and SDK tests. CI also regenerates the OpenAPI models and
checks the Node and React examples. TypeScript pull requests use the reusable
Node 26 workflow. Pushes to `master` run the same validation before publication.

Use `make pack` to build tarballs in `sdks/typescript/artifacts/` or
`make publish-dry-run TARGET=packages/web` to preview a publication. The
publish and packing commands accept comma-separated workspace paths or full
npm package names. Omitting the target selects all public packages. Include
unpublished dependencies of an explicitly selected package in the selection.

The `publish-typescript.yml` workflow checks for a changed public version on
push. A manual dispatch on `master` can resume a release. The publish job
runs after validation and uses npm OIDC. Packages publish one at a time in workspace dependency order. Recursive pnpm publication skips
versions already on npm.
Only the publish job receives `id-token: write`.

Each npm package needs a Trusted Publisher for `Sudomimus/Sudomimus`,
workflow `publish-typescript.yml`, no environment, with direct publishing
enabled. For a new package, the owner can run `make publish-initial`
interactively to bootstrap public packages at `0.0.0` and configure trust.
For an existing package, preview the selection with
`make publish-initial TARGET=@sudomimus/token ARGS="--trust-only --dry-run"`.
Use `--trust-only` to configure its trust after reviewing the preview.

### Maintenance

`make depcheck` reports dependency and TypeScript workflow Action updates.
`make update-all ARGS=--dry-run` previews dependency and Action changes.
`update-dependencies`, `update-actions` and `update-self` can run separately.
Action updates use the GitHub CLI to resolve stable releases to full commit
SHAs in the two TypeScript workflows. `iud` installs, updates within existing
constraints, deduplicates, and updates pnpm. `sort-all` normalizes dependency
and workspace ordering. `make organize` also refreshes the cloc inventory
and source headers. Run validation after applying maintenance updates.

## PyPI and NuGet

A push to `master` that changes a Python `pyproject.toml` or C# project
manifest triggers its existing workflow. It tests the SDK and publishes
changed packages in dependency order. Review version fields before pushing.

Before the first PyPI and NuGet runs, add these GitHub Actions repository secrets:

| Secret | Used by |
| --- | --- |
| `UV_PUBLISH_TOKEN` | PyPI publishing for the `sudomimus-*` projects |
| `NUGET_API_KEY` | NuGet publishing for the `Sudomimus.*` packages |

Update fixed inter-package dependency versions in the same change as their
dependencies. Update `sdks/python/uv.lock` after changing Python package
metadata; the publish workflow requires the lockfile to be current.

Pack a dependency and its workspace consumers together when their published
manifests pin exact versions. Verify that the Next.js, Nuxt, and React Router
tarballs reference the new `@sudomimus/web` package. Check the generated Python
wheel dependencies against the updated lockfile.

Go keeps its test workflow but has no publish workflow here. Java currently has
local Maven publishing only.
