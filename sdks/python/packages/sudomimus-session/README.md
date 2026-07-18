# sudomimus-session

Python SDK for the Sudomimus Session API. Use it after Connect, Device, or
Native has issued an ordinary access/refresh token pair.

The Session `/refresh` endpoint accepts only `APPLICATION` refresh-token
families. OIDC refresh tokens must use the OIDC `/token` endpoint; passing one
here raises `SessionApiError` with status `401` and reason
`RefreshTokenInvalidType`.

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
