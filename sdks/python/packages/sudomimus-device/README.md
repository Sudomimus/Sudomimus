# sudomimus-device

Python SDK for the Sudomimus Device API: public-client device authorization via
`/device-authorize` and `/device-token`.

The Device API does not refresh tokens itself. A successful `/device-token`
returns a normal Sudomimus access/refresh pair; use `sudomimus-connect` for
later `/refresh`, `/logout`, `/introspect`, and `/revoke-all`.

## Manual polling and manual storage

```python
import time

from sudomimus_device import (
    DeviceAuthorizeRequest,
    DeviceClient,
    DeviceTokenApiError,
    DeviceTokenRequest,
)

client = DeviceClient()
auth = client.device_authorize(DeviceAuthorizeRequest(applicationAnchor="my-app"))
print(auth.userCode, auth.verificationUriComplete)

while True:
    try:
        tokens = client.device_token(DeviceTokenRequest(deviceCode=auth.deviceCode))
        # Persist tokens.accessToken / tokens.refreshToken yourself.
        break
    except DeviceTokenApiError as exc:
        if exc.error in {"authorization_pending", "slow_down"}:
            time.sleep(exc.interval or auth.interval)
            continue
        raise
```

## Automatic polling with Connect-compatible storage

```python
from sudomimus_connect import ConnectClient, InMemoryTokenStore, RotatingConnectClient
from sudomimus_device import DeviceAuthenticator, DeviceAuthorizeRequest, DeviceClient

store = InMemoryTokenStore()
device = DeviceAuthenticator(
    DeviceClient(),
    store=store,
    open_url=lambda url, auth: print("Open:", url),
)

result = device.authorize_and_poll(DeviceAuthorizeRequest(applicationAnchor="my-app"))
print(result.tokens.accessToken)

# Later refresh/logout through Connect using the same store.
rotating = RotatingConnectClient(ConnectClient(), store)
access_token = rotating.refresh()
```

Async variants are available as `AsyncDeviceClient` and
`AsyncDeviceAuthenticator`.
