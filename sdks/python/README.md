# Sudomimus Python SDKs

This workspace hosts the Python SDKs published to PyPI.

## Packages

| Package | Spec | Purpose |
| --- | --- | --- |
| [`sudomimus-connect`](packages/sudomimus-connect) | [`specs/connect.yaml`](../../specs/connect.yaml) | Token exchange (Establish / Redeem / Refresh) |
| [`sudomimus-native`](packages/sudomimus-native) | [`specs/native.yaml`](../../specs/native.yaml) | Native client entry point |

## Tooling

- [uv](https://docs.astral.sh/uv) workspaces (Python 3.11+)
- [hatchling](https://hatch.pypa.io/latest/) build backend
- [ruff](https://docs.astral.sh/ruff) for lint and format
- [pytest](https://pytest.org) for testing
- [datamodel-code-generator](https://koxudaxi.github.io/datamodel-code-generator/) for generating Pydantic v2 models from OpenAPI specs

## Develop

```bash
cd sdks/python
uv sync
uv run python tasks.py generate    # regenerate packages/*/src/sudomimus_*/_generated/models.py
uv run ruff check
uv run pytest
```

Generated files live under `packages/*/src/sudomimus_*/_generated/` and are checked in. After editing a spec, run `uv run python tasks.py generate` and commit the regenerated files.
