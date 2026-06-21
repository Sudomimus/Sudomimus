# Sudomimus Python SDKs

This workspace hosts the Python SDKs published to PyPI.

## Packages

| Package | Spec | Purpose |
| --- | --- | --- |
| [`sudomimus-connect`](packages/sudomimus-connect) | [`specs/connect.yaml`](../../specs/connect.yaml) | Token exchange (Establish / StatusPoll / Redeem / Refresh / Info / Introspect / Logout / RevokeAll) |
| [`sudomimus-device`](packages/sudomimus-device) | [`specs/device.yaml`](../../specs/device.yaml) | Device authorization for public clients (DeviceAuthorize / DeviceToken) |
| [`sudomimus-token`](packages/sudomimus-token) | — (hand-written) | Parse and verify Sudomimus access / refresh JWTs |
| [`sudomimus-native`](packages/sudomimus-native) | [`specs/native.yaml`](../../specs/native.yaml) | Direct-issue (Steam ticket / access key) |

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
uv run mypy packages/sudomimus-token/src packages/sudomimus-native/src packages/sudomimus-connect/src packages/sudomimus-device/src
uv run pytest
uv run pytest --cov=sudomimus_token --cov=sudomimus_native --cov=sudomimus_connect --cov=sudomimus_device --cov-report=term-missing
```

Generated files live under `packages/*/src/sudomimus_*/_generated/` and are checked in. After editing a spec, run `uv run python tasks.py generate` and commit the regenerated files. `sudomimus-token` has no spec — its models are hand-written.
