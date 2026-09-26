# Common Skills Repository Policy

## Repository profile

- Repository purpose: Hosts Sudomimus client SDKs across languages and framework integrations, as described in `docs/README.md` and `CONTRIBUTING.md`.
- Artifact language: English, per `CONTRIBUTING.md`.
- User communication language: Follow the user; this user requested Chinese.
- Applicable instructions: Discover root and nearer `AGENTS.md` files; also follow `CONTRIBUTING.md`.
- Validation command: Not configured as one full-repository command; per-language commands are documented in `Makefile` and `.github/workflows/`.

## Documentation and terminology

- Documentation index: `docs/README.md` is the repository overview and links to language-specific guides; see `docs/` and each SDK README for additional guidance.
- Current-contract sources: `specs/README.md` and the OpenAPI files under `specs/` define public API contracts; SDK package READMEs and tests describe each SDK surface. `specs/` is an excluded submodule for Git operations unless the user explicitly expands scope.
- Canonical terminology: Not configured; follow the public contract and established package documentation.
- Working documents: `working/` holds temporary, non-authoritative working documents; remove them when no longer needed.
- Audit context: Follow `.agents/audit-policy.md`; `CODEBASE_AUDIT.md` is a historical point-in-time report, not an authority source.
- Inline documentation updates: Update the owning README or guide when directly required by a requested API or behavior change. Do not modify the excluded `specs/` submodule without explicit scope.
- Prohibited documentation patterns: Not configured.

## Decision records

- Decision-record directory: Not configured.
- Decision-record guide: Not configured.
- Numbering and filename convention: Not configured.
- Decision threshold: Use the common-skill threshold for durable, cross-cutting decisions whose rationale would otherwise be hard to recover.
- Relationship to current contracts: Decision records, if later configured, explain rationale and do not override the public API contracts in `specs/`.
- Replacement-link style: Follow the touched document's existing link style.

## Git repositories and commits

- Root repository: Sudomimus SDK repository at `.`.
- Included nested repositories: None.
- Excluded repositories and paths: `specs/` (`sudomimus/sudomimus-spec` submodule) and the core monorepo outside this checkout. Do not enter, inspect, stage, commit, or update either. Root status may reveal only the `specs/` gitlink state; do not inspect its target.
- Nested-repository commit order: No nested repository is included; never create or update an excluded gitlink.
- Status and history inspection: Only the root repository, and only within the user's authorized task scope. Do not inspect the core monorepo or excluded submodule.
- Commit plan modes: Compact, Balanced, and Detailed; Balanced is the default.
- Commit identity: Use the effective Git author and committer identity without changing Git configuration; stop if required identity values are missing.
- Commit message convention: English, why-focused messages of one or two sentences per `CONTRIBUTING.md`; recent history commonly uses prefixes such as `docs:`, `chore:`, and `feat:`.
- Staging restrictions: Stage only planned paths or explicitly named hunks. Do not use broad staging; never stage `specs/` or content from the core monorepo.
- Verification before commit: Run `git diff --cached --check` and targeted checks for the changed language or package, using supported `Makefile` targets or the corresponding CI workflow.
- Post-commit actions: Do not push, amend, rebase, reset, or discard changes unless the user separately requests it.

## Plan discussion and review

- Repository exploration: Prefer the relevant contract, implementation, tests, READMEs, `Makefile`, and CI workflow before asking; ask only for material unresolved choices.
- Required review authority: Applicable `AGENTS.md` files, `CONTRIBUTING.md`, `docs/README.md`, SDK documentation, `specs/README.md` as read-only contract context, `Makefile`, CI workflows, and configured decision records (none currently).
- Independent plan review: Disabled unless the user asks for delegation.
- Documentation during grilling: Update documentation only when directly requested or required by an agreed change, and only in an included repository.

## Handoff

- Output location: `/private/tmp`.
- Filename convention: `sudomimus-handoff-YYYY-MM-DD-HHMMSS.md`.
- Required sections: Summary, decisions, repository state, verification, and remaining work.
- Sensitive information: Exclude secrets, credentials, private keys, and token values.
- Existing-artifact references: Prefer repository-relative paths and direct links to existing artifacts.
