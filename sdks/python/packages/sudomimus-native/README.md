# sudomimus-native

Python SDK for the Sudomimus Native API — the public gateway used by native clients (desktop applications, games) to authenticate through an external browser.

## Install

```bash
pip install sudomimus-native
```

## Usage

```python
from sudomimus_native import NativeClient

client = NativeClient(base_url="https://native.sudomimus.com")
```

## Models

Pydantic v2 models are generated from [`specs/native.yaml`](../../../../specs/native.yaml) and re-exported from the package root:

```python
from sudomimus_native import (
    NativeError,
    StatusPollRequest,
    StatusPollResponse,
)
```

## License

[MIT](../../../../LICENSE)
