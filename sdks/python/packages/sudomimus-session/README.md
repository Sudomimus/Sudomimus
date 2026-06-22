# sudomimus-session

Python SDK for the Sudomimus Session API. Use it after Connect, Device, or
Native has issued an ordinary access/refresh token pair.

```python
from sudomimus_session import InMemoryTokenStore, RotatingSessionClient, SessionClient, TokenPair

session = RotatingSessionClient(SessionClient(), InMemoryTokenStore())
session.seed(TokenPair(access_token=access_token, refresh_token=refresh_token))

new_access_token = session.refresh()
session.logout()
```

`revoke_all` requires client-auth JWT signing with audience
`sudomimus-session`:

```python
from sudomimus_session import SessionClient, SessionClientAuthWithKey, RevokeAllRequest

client = SessionClient(
    client_auth=SessionClientAuthWithKey(
        application_anchor="app_anchor",
        private_key_pem=private_key_pem,
    )
)

client.revoke_all(RevokeAllRequest(subject="sector-subject"))
```

Pydantic v2 models are generated from [`specs/session.yaml`](../../../../specs/session.yaml).
