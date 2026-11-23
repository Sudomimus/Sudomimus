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

## Basic Terms confirmation

If Steam direct issue returns `403 LegalAgreementRequired`, use `agreement`
from the error body. Render the complete `document` from one locale, including
its table and links, and obtain explicit confirmation. Request a fresh Steam
ticket and send `agreementAcceptance` with the displayed `requiredRevision`,
the selected `locale`, its `contentSha256`, and `confirmed: true`.

A `409 LegalAgreementRevisionMismatch` carries the current `requiredRevision`.
Start a fresh attempt to retrieve the current challenge and ask the player to
confirm that version. For AccessKey or PublicKey, display `termsUrl` and ask the
account holder to accept the terms during a browser sign-in before retrying.

The `DirectIssueDeniedError` body exposes the typed `agreement` and
`termsUrl`. Its locale snapshots are available at `agreement.locales.en_US`
and `agreement.locales.zh_CN`. Pass an `AgreementAcceptance` to the new
`DirectIssueSteamTicketRequest`. The `DirectIssueSteamTicketConflictError` body
exposes `requiredRevision` on a revision conflict.
