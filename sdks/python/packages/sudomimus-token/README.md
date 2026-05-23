# sudomimus-token

Python SDK for parsing and verifying Sudomimus access and refresh JWTs.

Sudomimus tokens carry the standard envelope claims (`iss`, `aud`, `iat`,
`exp`, `jti`, `kty`) in the JWT **header**; the body holds only the
application-specific claims. The verifier checks structure, key type,
audience, expiration, and the RS256 signature against an application public
key you resolve (typically via the Connect `/info` endpoint).

## Install

```bash
pip install sudomimus-token
```

## Usage

```python
from sudomimus_token import TokenVerifier

def resolve_public_key(application_anchor: str) -> str:
    # Fetch the application's PEM public key (e.g. from Connect /info).
    ...

verifier = TokenVerifier(resolve_public_key)
access = verifier.verify_access_token(jwt)
print(access.body.accountIdentifier, access.header.aud)
```

Async callers use `AsyncTokenVerifier` with an awaitable resolver:

```python
from sudomimus_token import AsyncTokenVerifier

verifier = AsyncTokenVerifier(resolve_public_key_async)
access = await verifier.verify_access_token(jwt)
```

Verification failures raise `TokenError` with a `code` drawn from
`TokenErrorCode` (`INVALID_JWT`, `WRONG_KEY_TYPE`, `MISSING_AUDIENCE`,
`EXPIRED`, `INVALID_SIGNATURE`).

For read-only inspection without trust decisions, use `parse_access_token`,
`parse_refresh_token`, or `peek_header`.

## License

[MIT](../../../../LICENSE)
