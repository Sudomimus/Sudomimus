# Codebase Coherence Audit — 2026-05-25

## Summary
- 9 findings: 5 high, 3 medium, 1 low
- Sources of truth used: `README.md`, `CONTRIBUTING.md`, `specs/README.md`, `specs/connect.yaml`, `sdks/typescript/README.md`, `sdks/python/README.md`, `sdks/typescript/packages/{connect,native,token}/README.md`, `sdks/python/packages/sudomimus-{connect,native,token}/README.md`, `sdks/csharp/src/Sudomimus.{Native,Token}/README.md`, `Makefile`, `sdks/typescript/package.json`, `sdks/python/pyproject.toml`, recent git log
- Conventions extracted:
  - Repository layout: `specs/`, `sdks/typescript/`, `sdks/python/`, `examples/` (per root README + CONTRIBUTING)
  - TypeScript: JSDoc file header, double quotes, trailing commas, one import per line
  - Python: `src/` layout, public APIs via `__init__.py`, generated models under `_generated/` and never edited
  - Spec changes go through the `sudomimus-spec` git submodule, regenerate models, commit submodule bump + regen together
  - Root README status table must be updated when a package's status changes (CONTRIBUTING PR checklist)

## Findings

### #1 — Root README and CONTRIBUTING ignore the entire C# SDK  [high | doc-drift]
**Location:** [README.md:9-16](README.md), [README.md:18-25](README.md), [CONTRIBUTING.md:6-10](CONTRIBUTING.md), [CONTRIBUTING.md:63-69](CONTRIBUTING.md)
**Source of truth:** `sdks/csharp/` exists with `Sudomimus.Native` and `Sudomimus.Token` projects (each with its own README, csproj, and tests). The `Makefile` has full first-class C# targets (`compile-csharp`, `test-csharp`, `coverage-csharp`, `pack-csharp`, `publish-token-cs`, `publish-native-cs`, etc.). Recent commits include "Add unit tests for Sudomimus.Token parser and JwtToken" (2851b3b) and "add support for access-key authentication to C# console example" (4c02f1a).
**Evidence:** Root README "SDK status" table only lists TypeScript and Python rows; "Repository layout" lists only `specs/`, `sdks/typescript/`, `sdks/python/`, `examples/`. CONTRIBUTING.md "Repository layout" omits `sdks/csharp/`; "PR checklist" has no C# build/test step; there is no "C# conventions" section.
**Suggested fix:** Add C# rows for `Sudomimus.Connect` (if/when it ships — currently only Native + Token exist), `Sudomimus.Native`, and `Sudomimus.Token` to the root README status table; add `sdks/csharp/` to the layout block in both files; add a C# PR-checklist line (`dotnet build` / `dotnet test`) and at minimum a one-line pointer to the C# conventions (or note that they follow `Directory.Build.props`).

### #2 — Root README claims a Connect surface that the package no longer exports a hint of inside the workspace README  [high | internal-inconsistency]
**Location:** [sdks/typescript/README.md:9](sdks/typescript/README.md)
**Source of truth:** Root [README.md:11](README.md) and the package's own [sdks/typescript/packages/connect/README.md:3](sdks/typescript/packages/connect/README.md) both describe the Connect surface as "Establish / StatusPoll / Redeem / Refresh / Info / Introspect / Logout / RevokeAll" (commit d098f11 added introspect/logout/revoke-all).
**Evidence:** `sdks/typescript/README.md:9` still describes `@sudomimus/connect` as "Token exchange (Establish / Redeem / Refresh)".
**Suggested fix:** Update the workspace README purpose column to match the package README / root README — `"Token exchange (Establish / StatusPoll / Redeem / Refresh / Info / Introspect / Logout / RevokeAll)"`.

### #3 — `@sudomimus/native` purpose is stale in the TypeScript workspace README  [high | internal-inconsistency]
**Location:** [sdks/typescript/README.md:11](sdks/typescript/README.md)
**Source of truth:** Root [README.md:13](README.md) and the package's own [sdks/typescript/packages/native/README.md:3](sdks/typescript/packages/native/README.md) describe Native as the direct-issue gateway (Steam ticket / access key). Commit 22203be added the access-key path.
**Evidence:** `sdks/typescript/README.md:11` still calls Native the "Native client entry point" — a description that predates the SDK actually being a direct-issue client.
**Suggested fix:** Update to `"Direct-issue (Steam ticket / access key)"` to match the other two sources of truth.

### #4 — Python workspace README undersells Connect (missing 3 endpoints)  [high | internal-inconsistency]
**Location:** [sdks/python/README.md:9](sdks/python/README.md)
**Source of truth:** Root [README.md:14](README.md) lists Establish / StatusPoll / Redeem / Refresh / Info / Introspect / Logout / RevokeAll. The Python package README ([sdks/python/packages/sudomimus-connect/README.md:3-9](sdks/python/packages/sudomimus-connect/README.md)) documents all of those. Commit d098f11 ("Add introspect, logout, and revoke-all to the Connect SDKs") added them.
**Evidence:** `sdks/python/README.md:9` says `"Token exchange (Establish / StatusPoll / Redeem / Refresh / Info)"`. Missing: Introspect, Logout, RevokeAll.
**Suggested fix:** Extend the purpose column to match the root README / package README.

### #5 — `specs/README.md` describes a Connect surface that has been substantially extended  [high | doc-drift]
**Location:** [specs/README.md:9](specs/README.md)
**Source of truth:** `specs/connect.yaml` now exposes `/health`, `/establish`, `/status-poll`, `/redeem`, `/refresh`, `/info`, `/introspect`, `/logout`, `/revoke-all`. Commit c639491 ("Update spec submodule to add Connect session endpoints") added the introspect/logout/revoke-all trio.
**Evidence:** `specs/README.md:9` still says `"Token exchange (Establish / Redeem / Refresh)"`.
**Suggested fix:** Update to the full list. Either an exhaustive list (matching the root README) or a shorter taxonomy like `"Token exchange + session revocation (Establish / StatusPoll / Redeem / Refresh / Info / Introspect / Logout / RevokeAll)"`. (Note: this file lives in the `sudomimus-spec` submodule — the fix lands in that repo, then we bump the submodule pointer here.)

### #6 — CONTRIBUTING tells contributors to run a `task` script that doesn't exist  [medium | doc-drift]
**Location:** [CONTRIBUTING.md:58](CONTRIBUTING.md)
**Source of truth:** `sdks/python/pyproject.toml` declares no `taskipy` config and no `task` script. The Python workspace README and the Makefile both invoke generation as `uv run python tasks.py generate` ([sdks/python/README.md:26](sdks/python/README.md), Makefile target `generate-py`).
**Evidence:** CONTRIBUTING.md line 58: `"uv run task generate"` in `sdks/python` — this will fail with "command not found" for any new contributor following the docs verbatim.
**Suggested fix:** Change to `uv run python tasks.py generate` (matching the Python README and Makefile).

### #7 — CONTRIBUTING PR checklist doesn't match the Makefile-blessed verification commands  [medium | doc-drift]
**Location:** [CONTRIBUTING.md:65-69](CONTRIBUTING.md)
**Source of truth:** The Makefile and SDK READMEs declare the verification surface: TypeScript uses `pnpm lint && pnpm compile && pnpm test` (+ `pnpm coverage`); Python uses `uv run ruff check && uv run mypy <src dirs> && uv run pytest` (the `typecheck-py` and `coverage-py` Makefile targets); C# uses `dotnet build` / `dotnet test`.
**Evidence:** CONTRIBUTING.md checklist mentions only `uv run ruff check && uv run pytest` for Python (no mypy, even though `typecheck-py` exists and `mypy` is a declared dev dep), and has no C# verification entry at all despite a fully wired C# toolchain.
**Suggested fix:** Add `uv run mypy …` to the Python line, add a C# line (`dotnet build` + `dotnet test` from `sdks/csharp`, or `make compile-csharp test-csharp` from the repo root).

### #8 — Makefile points at a non-existent docs file  [medium | stale-reference]
**Location:** [Makefile:104](Makefile)
**Source of truth:** `ls docs/` returns "No such file or directory" — there is no `docs/` folder in the repo at all.
**Evidence:** The C# section header says `"# All -cs targets operate on sdks/csharp/. NuGet pushes require / NUGET_API_KEY to be set (see docs/csharp-nuget-publish.md)."`. The referenced file does not exist.
**Suggested fix:** Either create `docs/csharp-nuget-publish.md` (preferred, since the publish flow is non-trivial — it needs `NUGET_API_KEY`, signing notes, dry-run inspection), or drop the parenthetical and inline the minimum instructions in a comment.

### #9 — TypeScript workspace README's Develop section omits `pnpm coverage`  [low | internal-inconsistency]
**Location:** [sdks/typescript/README.md:24-31](sdks/typescript/README.md)
**Source of truth:** [sdks/typescript/package.json](sdks/typescript/package.json) declares a `coverage` script (commit c2a87f0, "Add coverage scripts for all three SDKs"); the Makefile has matching `coverage` and `coverage-py` targets.
**Evidence:** The Develop block lists `pnpm install / generate / compile / lint / test` but not `pnpm coverage`. The Python README similarly does not list a coverage command, though one exists via the Makefile.
**Suggested fix:** Add `pnpm coverage` to the TS Develop list; consider adding a one-line coverage hint to the Python README too.

---

Reply with the numbers you want refactored (e.g. `fix #2, #5, #9`) to enter Phase 2.
