# sudomimus-native

Python SDK for the Sudomimus Native API — the direct-issue gateway for
native callers (desktop applications, games, headless processes). Exchange a
Steam Web API auth ticket or an access-key credential for application access
and refresh tokens in a single round trip.

## Install

```bash
pip install sudomimus-native
```

## Usage

```python
from sudomimus_native import NativeClient, DirectIssueSteamTicketRequest

with NativeClient() as client:
    tokens = client.direct_issue_steam_ticket(
        DirectIssueSteamTicketRequest(
            applicationAnchor="my-app",
            steamTicketHex="...",  # from GetAuthTicketForWebApi("sudomimus")
            steamAppId=480,
        )
    )
    print(tokens.accessToken, tokens.refreshToken)
```

Access-key credentials (issued in the admin console for headless callers):

```python
from sudomimus_native import DirectIssueAccessKeyRequest

tokens = client.direct_issue_access_key(
    DirectIssueAccessKeyRequest(
        applicationAnchor="my-app",
        accessKeyIdentifier="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        accessKeySecret="<64 hex chars>",
    )
)
```

An `AsyncNativeClient` with the same methods is available for `asyncio`
callers. Non-2xx responses raise `NativeApiError` (inspect `.status` and
`.reason`). Issued tokens are opaque to this SDK; verify them with
[`sudomimus-token`](../sudomimus-token).

## Models

Pydantic v2 models are generated from [`specs/native.yaml`](../../../../specs/native.yaml)
and re-exported from the package root:

```python
from sudomimus_native import (
    DirectIssueAccessKeyRequest,
    DirectIssueAccessKeyResponse,
    DirectIssueSteamTicketRequest,
    DirectIssueSteamTicketResponse,
    NativeError,
)
```

## License

[MIT](../../../../LICENSE)
