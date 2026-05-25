# Sudomimus

Open-source SDKs for the [Sudomimus](https://sudomimus.com) authentication and authorization platform.

This repository hosts client SDKs for the public Sudomimus APIs, organized by language. Each language ships one SDK per public API service (for example, `connect` for token exchange and `native` for the native client entry point).

## SDK status

| Language | Package | Purpose | Status |
| --- | --- | --- | --- |
| TypeScript | [`@sudomimus/connect`](sdks/typescript/packages/connect) | Token exchange (Establish / StatusPoll / Redeem / Refresh / Info) | alpha |
| TypeScript | [`@sudomimus/token`](sdks/typescript/packages/token) | Parse and verify Sudomimus access / refresh JWTs | alpha |
| TypeScript | [`@sudomimus/native`](sdks/typescript/packages/native) | Direct-issue (Steam ticket / access key) | alpha |
| Python | [`sudomimus-connect`](sdks/python/packages/sudomimus-connect) | Token exchange (Establish / StatusPoll / Redeem / Refresh / Info) | alpha |
| Python | [`sudomimus-token`](sdks/python/packages/sudomimus-token) | Parse and verify Sudomimus access / refresh JWTs | alpha |
| Python | [`sudomimus-native`](sdks/python/packages/sudomimus-native) | Direct-issue (Steam ticket / access key) | alpha |

## Repository layout

```
specs/                   OpenAPI 3.1 contracts, one file per public service
sdks/typescript/         TypeScript / JavaScript SDKs (pnpm + Turborepo workspace)
sdks/python/             Python SDKs (uv workspace)
examples/                Per-language usage examples
```

See [`sdks/typescript/README.md`](sdks/typescript/README.md) and [`sdks/python/README.md`](sdks/python/README.md) for language-specific development instructions.

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
