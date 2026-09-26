# Sudomimus

Open-source SDKs for the [Sudomimus](https://sudomimus.com) authentication and authorization platform.

This repository hosts client SDKs for the public Sudomimus APIs, organized by language, plus framework integrations above those SDKs. Each language ships one SDK per public API service (for example, `connect` for token exchange and `native` for the native client entry point).

## SDK status

| Language | Package | Purpose | Status |
| --- | --- | --- | --- |
| TypeScript | [`@sudomimus/connect`](sdks/typescript/packages/connect) | Inquiry lifecycle (Establish / StatusPoll / Redeem / Info) | stable |
| TypeScript | [`@sudomimus/device`](sdks/typescript/packages/device) | Device authorization for public clients (DeviceAuthorize / DeviceToken) | stable |
| TypeScript | [`@sudomimus/token`](sdks/typescript/packages/token) | Parse and verify Account / Workload access and refresh JWTs | stable |
| TypeScript | [`@sudomimus/native`](sdks/typescript/packages/native) | Direct-issue (Steam / access key / public key) | stable |
| TypeScript | [`@sudomimus/session`](sdks/typescript/packages/session) | Session lifecycle (Refresh / Introspect / Logout / RevokeAll) | stable |
| Python | [`sudomimus-connect`](sdks/python/packages/sudomimus-connect) | Inquiry lifecycle (Establish / StatusPoll / Redeem / Info) | stable |
| Python | [`sudomimus-device`](sdks/python/packages/sudomimus-device) | Device authorization for public clients (DeviceAuthorize / DeviceToken) | stable |
| Python | [`sudomimus-token`](sdks/python/packages/sudomimus-token) | Parse and verify Sudomimus access / refresh JWTs | stable |
| Python | [`sudomimus-native`](sdks/python/packages/sudomimus-native) | Direct-issue (Steam ticket / access key) | stable |
| Python | [`sudomimus-session`](sdks/python/packages/sudomimus-session) | Session lifecycle (Refresh / Introspect / Logout / RevokeAll) | stable |
| C# / .NET | [`Sudomimus.Connect`](sdks/csharp/src/Sudomimus.Connect) | Inquiry lifecycle (Establish / StatusPoll / Redeem / Info) | stable |
| C# / .NET | [`Sudomimus.Token`](sdks/csharp/src/Sudomimus.Token) | Parse and verify Sudomimus access / refresh JWTs | stable |
| C# / .NET | [`Sudomimus.Native`](sdks/csharp/src/Sudomimus.Native) | Direct-issue (Steam ticket / access key) | stable |
| C# / .NET | [`Sudomimus.Session`](sdks/csharp/src/Sudomimus.Session) | Session lifecycle (Refresh / Introspect / Logout / RevokeAll) | stable |
| Go | [`github.com/sudomimus/sudomimus-go/token`](sdks/go/token) | Parse and verify Sudomimus access / refresh JWTs | stable |
| Java | [`com.sudomimus:sudomimus-token`](sdks/java/token) | Parse and verify Sudomimus access / refresh JWTs | stable |

## Framework integrations

These packages adapt the ordinary Connect callback and Session lifecycle to
web frameworks. They sit above the API SDKs and do not use OIDC.

| Framework | Package | Status |
| --- | --- | --- |
| Next.js App Router | [`@sudomimus/nextjs`](sdks/typescript/packages/nextjs) | stable |
| React Router Framework Mode | [`@sudomimus/react-router`](sdks/typescript/packages/react-router) | stable |
| Nuxt Node/Nitro | [`@sudomimus/nuxt`](sdks/typescript/packages/nuxt) | stable |
| Django | [`sudomimus-django`](sdks/python/packages/sudomimus-django) | stable |

The TypeScript integrations share [`@sudomimus/web`](sdks/typescript/packages/web)
for login state, session rotation, and the durable storage contract.

## Repository layout

```
specs/                   OpenAPI 3.1 contracts, one file per public service
sdks/typescript/         TypeScript / JavaScript SDKs (pnpm + Turborepo workspace)
sdks/python/             Python SDKs (uv workspace)
sdks/csharp/             C# / .NET 8 SDKs (dotnet solution, NuGet packages)
sdks/go/                 Go SDKs (single module, github.com/sudomimus/sudomimus-go)
sdks/java/               Java SDKs (Gradle Kotlin DSL multi-module, JDK 17)
examples/                Runnable usage examples (see examples/README.md)
```

See [`sdks/typescript/README.md`](sdks/typescript/README.md), [`sdks/python/README.md`](sdks/python/README.md), [`sdks/go/README.md`](sdks/go/README.md), [`sdks/java/README.md`](sdks/java/README.md), and the per-project READMEs under [`sdks/csharp/src/`](sdks/csharp/src) for language-specific development instructions. The repo-root [`Makefile`](Makefile) exposes consistent `compile-*`, `test-*`, `coverage-*`, and `pack-*` targets across all languages.

## API schemas

Public API contracts live in [`specs/`](specs) as hand-maintained OpenAPI 3.1 documents. Each SDK generates strongly typed request, response, and error models from the corresponding spec; client logic (HTTP, authentication, retries) is written by hand.

`specs/` is a git submodule tracking [`sudomimus/sudomimus-spec`](https://github.com/sudomimus/sudomimus-spec), shared with the internal platform repository. Clone with submodules so the spec files are present:

```
git clone --recurse-submodules https://github.com/sudomimus/sudomimus.git
# or, in an existing checkout:
git submodule update --init --recursive
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
