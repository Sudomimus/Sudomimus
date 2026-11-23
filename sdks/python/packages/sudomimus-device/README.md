# sudomimus-device

Python SDK for the Sudomimus Device API: public-client device authorization via
`/device-authorize` and `/device-token`.

The Device API does not refresh tokens itself. A successful `/device-token`
returns a normal Sudomimus access/refresh pair; use `sudomimus-session` for
later `/refresh`, `/logout`, `/introspect`, and `/revoke-all`.

`device_authorize` may reject admission with a bodyless `429` when creation
budgets are exhausted or a bodyless `503` when admission counters are
unavailable. Both raise `DeviceApiError` with `reason` and `body` set to
`None`; back off before retrying.

## Browser approval

The client validates both verification URLs before returning authorization
details to display or open. Use HTTPS or loopback HTTP for local development
on `localhost`, `127.0.0.1`, or `[::1]`. If the server ends polling with
`access_denied`, a new browser authorization is required to try again. This
includes approval recorded before the account accepted the current Basic
Terms.

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

Automatic polling waits for the returned interval before the first exchange.
The authorization lifetime starts when the client receives the authorization
response. It counts the time spent displaying the code or opening the browser.
A request that is already in flight can still finish when the polling deadline
passes.

```python
from sudomimus_session import InMemoryTokenStore, RotatingSessionClient, SessionClient
from sudomimus_device import DeviceAuthenticator, DeviceAuthorizeRequest, DeviceClient

store = InMemoryTokenStore()
device = DeviceAuthenticator(
    DeviceClient(),
    store=store,
    open_url=lambda url, auth: print("Open:", url),
)

result = device.authorize_and_poll(DeviceAuthorizeRequest(applicationAnchor="my-app"))
print(result.tokens.accessToken)

# Later refresh/logout through Session using the same store.
rotating = RotatingSessionClient(SessionClient(), store)
access_token = rotating.refresh()
```

Async variants are available as `AsyncDeviceClient` and
`AsyncDeviceAuthenticator`.
