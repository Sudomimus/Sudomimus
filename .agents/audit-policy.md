# Repository Audit Policy

## Repository profile

- Repository purpose: Hosts Sudomimus client SDKs across languages and framework integrations, as described in `docs/README.md` and `CONTRIBUTING.md`.
- Artifact language: English for checked-in artifacts, per `CONTRIBUTING.md`.
- User communication language: Follow the user; this user requested Chinese.
- Applicable instructions: Discover root and nearer `AGENTS.md` files; also follow `CONTRIBUTING.md`.

## Authority and decisions

- Current-contract sources: `specs/README.md` and the OpenAPI files under `specs/`; SDK documentation and tests describe SDK-specific behavior.
- Decision records: Not configured.
- Classification guide: Built into common audit skills.
- Conflict handling: The OpenAPI contract governs the public API; compare SDK behavior against it and record unresolved mismatches without changing excluded repositories.

## Audit storage

- Scope log: Disabled.
- Scope-log entry format: Not constrained.
- Scope-log retention: Disabled.
- Reports directory: `docs/audits/`.
- Report filename convention: `YYYY-MM-DD_HH-MM-SS.md`.
- Report template override: Use skill template.

## Audit workflow

- Direction selection: Ask the user.
- Production edits during audit: Prohibited.
- Report threshold: At least one remediation-ready defect.
- Concurrency and concurrent-work handling: Inspect only the authorized root checkout; do not enter the `specs/` submodule or the excluded core monorepo.
- Git inspection: Only when explicitly authorized, and only in the Sudomimus root repository; no nested repository inspection by default.
- Empty-report history fallback: Disabled.

## Repository-specific review lenses

- Protected invariants: Correct JWT parsing and verification, safe handling of tokens and credentials, generated-schema consistency, and compatibility of published SDK interfaces.
- Priority surfaces: Authentication and token handling, HTTP client behavior, session rotation and token stores, generated API models, examples, and package publishing workflows.
- Excluded or accepted trade-offs: The core monorepo and the `specs/` submodule are outside Git inspection and mutation scope unless the user explicitly expands scope.

## Technology and change impact

- Runtime and package tooling: TypeScript uses pnpm and Turborepo (`sdks/typescript/`); Python uses uv (`sdks/python/`); C# uses .NET (`sdks/csharp/`); Go uses Go modules (`sdks/go/`); Java uses Gradle (`sdks/java/`).
- Persistence: The repository provides client-side token stores; it does not own the platform's server-side database or schema.
- Infrastructure and deployment: CI and package publishing are defined in `.github/workflows/`; no application deployment infrastructure is configured here.
- Public contracts: OpenAPI 3.1 documents in the excluded `specs/` submodule; treat them as read-only context unless scope is explicitly expanded.
- Cost dimensions: CI minutes and package-registry usage; no server infrastructure costs are configured in this repository.

## Verification

- Targeted checks: Use the affected language's `Makefile` targets or the corresponding `.github/workflows/ci-*.yml`; keep generated-file checks with spec-driven SDK changes.
- Broad checks: Run per-language CI-equivalent checks only when the audit scope warrants them; there is no single full-repository validation command.
- Report validation: Check Markdown links, formatting, and whitespace; redact credentials and token values.
