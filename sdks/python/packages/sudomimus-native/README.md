# sudomimus-native

Python SDK for the Sudomimus Native API — the direct-issue gateway for
native callers (desktop applications, games, headless processes). Exchange a
Steam Web API auth ticket, access-key credential, or signed Ed25519 key for application access
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
            accessKeyIdentifier="acs_k_01890c5e-1234-4abc-9def-0123456789ab",
            accessKeySecret="acs_t_<64 lowercase hex chars>",
        )
)
```

Registered public-key credentials accept a raw Ed25519 signing callback; the
SDK creates the short-lived assertion and binds it to the exact request bytes:

```python
from sudomimus_native import DirectIssuePublicKeyRequest, PublicKeyCredential

tokens = client.direct_issue_public_key(
    DirectIssuePublicKeyRequest(applicationAnchor="my-app"),
    PublicKeyCredential("pky_...", private_key.sign),
)
```

An `AsyncNativeClient` with the same methods is available for `asyncio`
callers. Non-2xx responses raise `NativeApiError` (inspect `.status` and
`.reason`). Steam and access-key admission failures return `429`, or `503`
when their counters are unavailable, with no reason body. Back off before
retrying. Issued tokens are opaque to this SDK; verify them with
[`sudomimus-token`](../sudomimus-token).

## Models

Pydantic v2 models are generated from [`specs/native.yaml`](../../../../specs/native.yaml)
and re-exported from the package root:

```python
from sudomimus_native import (
    DirectIssueAccessKeyRequest,
    DirectIssueAccessKeyResponse,
    DirectIssuePublicKeyRequest,
    PublicKeyCredential,
    DirectIssueSteamTicketRequest,
    DirectIssueSteamTicketResponse,
    NativeError,
)
```

## License

[MIT](../../../../LICENSE)
