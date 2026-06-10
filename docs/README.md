# Sudomimus

Open-source SDKs for the [Sudomimus](https://sudomimus.com) authentication and authorization platform.

This repository hosts client SDKs for the public Sudomimus APIs, organized by language. Each language ships one SDK per public API service (for example, `connect` for token exchange and `native` for the native client entry point).

## SDK status

| Language | Package | Purpose | Status |
| --- | --- | --- | --- |
| TypeScript | [`@sudomimus/connect`](sdks/typescript/packages/connect) | Token exchange (Establish / StatusPoll / Redeem / Refresh / Info / Introspect / Logout / RevokeAll) | alpha |
| TypeScript | [`@sudomimus/token`](sdks/typescript/packages/token) | Parse and verify Sudomimus access / refresh JWTs | alpha |
| TypeScript | [`@sudomimus/native`](sdks/typescript/packages/native) | Direct-issue (Steam ticket / access key) | alpha |
| Python | [`sudomimus-connect`](sdks/python/packages/sudomimus-connect) | Token exchange (Establish / StatusPoll / Redeem / Refresh / Info / Introspect / Logout / RevokeAll) | alpha |
| Python | [`sudomimus-token`](sdks/python/packages/sudomimus-token) | Parse and verify Sudomimus access / refresh JWTs | alpha |
| Python | [`sudomimus-native`](sdks/python/packages/sudomimus-native) | Direct-issue (Steam ticket / access key) | alpha |
| C# / .NET | [`Sudomimus.Connect`](sdks/csharp/src/Sudomimus.Connect) | Token exchange (Establish / StatusPoll / Redeem / Refresh / Info / Introspect / Logout / RevokeAll) | alpha |
| C# / .NET | [`Sudomimus.Token`](sdks/csharp/src/Sudomimus.Token) | Parse and verify Sudomimus access / refresh JWTs | alpha |
| C# / .NET | [`Sudomimus.Native`](sdks/csharp/src/Sudomimus.Native) | Direct-issue (Steam ticket / access key) | alpha |
| Go | [`github.com/sudomimus/sudomimus-go/token`](sdks/go/token) | Parse and verify Sudomimus access / refresh JWTs | alpha |
| Java | [`com.sudomimus:sudomimus-token`](sdks/java/token) | Parse and verify Sudomimus access / refresh JWTs | alpha |

## Repository layout

```
specs/                   OpenAPI 3.1 contracts, one file per public service
sdks/typescript/         TypeScript / JavaScript SDKs (pnpm + Turborepo workspace)
sdks/python/             Python SDKs (uv workspace)
sdks/csharp/             C# / .NET 8 SDKs (dotnet solution, NuGet packages)
sdks/go/                 Go SDKs (single module, github.com/sudomimus/sudomimus-go)
sdks/java/               Java SDKs (Gradle Kotlin DSL multi-module, JDK 17)
examples/                Per-language usage examples
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
