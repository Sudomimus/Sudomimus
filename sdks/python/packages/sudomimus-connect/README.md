# sudomimus-connect

Python SDK for the Sudomimus Connect API — the token-exchange entry point:
establish an authentication inquiry, poll its status, redeem it for
application tokens, refresh access tokens, fetch localized application
metadata, introspect a session's revocation status, and revoke sessions (one
via `/logout` or every session of an account via `/revoke-all`). Includes
client-auth JWT signing for `/establish` and `/revoke-all`, and token
verification (via [`sudomimus-token`](../sudomimus-token)).

## Install

```bash
pip install sudomimus-connect
```

## Usage

`/establish` requires a client-auth JWT signed with your application's
RS256 private key. Pass it via `client_auth`:

```python
from sudomimus_connect import (
    ConnectClient,
    ConnectClientAuthWithKey,
    EstablishRequest,
)

with ConnectClient(
    client_auth=ConnectClientAuthWithKey(
        application_anchor="my-app",
        private_key_pem=open("client-auth-private.pem").read(),
    )
) as client:
    inquiry = client.establish(EstablishRequest(applicationAnchor="my-app"))
    print(inquiry.exposureKey, inquiry.hiddenKey)
```

The other endpoints need no client auth:

```python
status = client.status_poll(StatusPollRequest(exposureKey=..., hiddenKey=...))
tokens = client.redeem(RedeemRequest(exposureKey=..., hiddenKey=..., confirmationKey=...))
# `/refresh` rotates the refresh token (OAuth 2.1 BCP §4.14.2 strict
# mode): every call returns BOTH a new access token AND a new refresh
# token, and invalidates the one you presented. Persist
# `fresh.refreshToken` BEFORE the next call. See the "Token storage
# contract" section below for the full rules.
fresh = client.refresh(RefreshRequest(refreshToken=tokens.refreshToken))
```

### Token storage contract (read this before shipping refresh)

The Connect API does **OAuth 2.1 BCP §4.14.2 strict refresh-token rotation**: every `/refresh` returns a new pair AND invalidates the refresh token you presented. Re-presenting an already-rotated refresh token (or losing the rotation race to a concurrent caller) is treated as evidence of compromise — the server revokes the entire refresh-token family and the user must re-authenticate from scratch.

This means **every successful `/refresh` MUST atomically replace your persisted refresh token** with the new one before any other code can read the old one. The contract is:

- Between the moment you read the current refresh token and the moment you persist the new pair, no other code path may read the old token. Use a per-session lock (database row lock, Redis `SETNX`, …) around `load → /refresh → save`.
- A partial write — new access stored, new refresh dropped — desynchronises you from the server, and the next `/refresh` will trip `RefreshTokenFamilyCompromised`.
- Two concurrent `/refresh` calls on the same refresh token will trip `RefreshTokenRotationRaceLost` on whichever loses the conditional write; the family is revoked on the server side.

The Python SDK does not currently ship a `TokenStore` abstraction. The TypeScript and .NET SDKs do (`RotatingConnectClient` + `TokenStore` / `ITokenStore`); a Python equivalent is on the roadmap. Until then, implement the locking and atomic-replace yourself, or open an issue if your use case would benefit from a built-in store.

Verify issued tokens (resolves and caches the application public key via
`/info`):

```python
access = client.verify_access_token(tokens.accessToken)
print(access.body.accountIdentifier)
```

Introspect and revoke sessions. `introspect` and `logout` need no client auth;
`revoke_all` is an application-authority action and requires `client_auth`
(exactly like `establish`):

```python
# Near-real-time revocation check; status is "active"/"revoked"/"expired"/"not_found".
state = client.introspect(IntrospectRequest(accessToken=tokens.accessToken))

# Revoke one session (idempotent); possession of the refresh token authorizes it.
client.logout(LogoutRequest(refreshToken=tokens.refreshToken))

# Revoke every session of an account for the calling application.
revoked = client.revoke_all(RevokeAllRequest(accountIdentifier="acct-1"))
print(revoked.revokedCount)
```

An `AsyncConnectClient` with the same methods is available for `asyncio`
callers (its BYO signer may be sync or async). Non-2xx responses raise
`ConnectApiError` (inspect `.status` and `.reason`).

## Models

Pydantic v2 models are generated from [`specs/connect.yaml`](../../../../specs/connect.yaml)
and re-exported from the package root:

```python
from sudomimus_connect import (
    ConnectError,
    EstablishRequest,
    EstablishResponse,
    InfoRequest,
    InfoResponse,
    IntrospectRequest,
    IntrospectResponse,
    LogoutRequest,
    LogoutResponse,
    RedeemRequest,
    RedeemResponse,
    RefreshRequest,
    RefreshResponse,
    RevokeAllRequest,
    RevokeAllResponse,
    StatusPollRequest,
    StatusPollResponse,
)
```

## License

[MIT](../../../../LICENSE)
