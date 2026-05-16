# sudomimus-connect

Python SDK for the Sudomimus Connect API — token exchange (Establish, Redeem, Refresh).

## Install

```bash
pip install sudomimus-connect
```

## Usage

```python
from sudomimus_connect import ConnectClient

client = ConnectClient(base_url="https://connect.sudomimus.com")
```

## Models

Pydantic v2 models are generated from [`specs/connect.yaml`](../../../../specs/connect.yaml) and re-exported from the package root:

```python
from sudomimus_connect import (
    ConnectError,
    EstablishRequest,
    EstablishResponse,
    RedeemRequest,
    RefreshRequest,
    TokenPair,
)
```

## License

[MIT](../../../../LICENSE)
