# sudomimus-connect

Python SDK for the Sudomimus Connect API. Connect owns the initial browser
inquiry lifecycle:

- `establish`
- `status_poll`
- `redeem`
- `info`

Use [`sudomimus-session`](../sudomimus-session) after `redeem` for `/refresh`,
`/introspect`, `/logout`, and `/revoke-all`.

```python
from sudomimus_connect import (
    ConnectClient,
    ConnectClientAuthWithKey,
    EstablishRequest,
    RedeemRequest,
    ReturnMethodDeclaration,
    ReturnMethodStatusPoll,
    StatusPollRequest,
)

with ConnectClient(
    client_auth=ConnectClientAuthWithKey(
        application_anchor="my-app",
        private_key_pem=private_key_pem,
    )
) as client:
    inquiry = client.establish(
        EstablishRequest(
            applicationAnchor="my-app",
            returnMethods=[
                ReturnMethodDeclaration(
                    root=ReturnMethodStatusPoll(type="STATUS_POLL", payload={})
                )
            ],
        )
    )
    status = client.status_poll(
        StatusPollRequest(exposureKey=inquiry.exposureKey, hiddenKey=inquiry.hiddenKey)
    )
    if status.root.status == "REALIZED":
        tokens = client.redeem(
            RedeemRequest(
                exposureKey=inquiry.exposureKey,
                hiddenKey=inquiry.hiddenKey,
                confirmationKey=status.root.confirmationKey,
            )
        )
```

`/establish` requires a client-auth JWT with audience `sudomimus-connect`.
Pass `client_auth` to let the SDK sign it, or provide a BYO signer.

`ConnectClient` also exposes `verify_access_token` and `verify_refresh_token`,
which resolve the application's public key through `/info` and cache it per
client instance. If you only need JWT verification, depend on
[`sudomimus-token`](../sudomimus-token) directly.

Pydantic v2 models are generated from
[`specs/connect.yaml`](../../../../specs/connect.yaml).
