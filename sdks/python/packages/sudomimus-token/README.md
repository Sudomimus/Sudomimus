# sudomimus-token

Python SDK for parsing and verifying Sudomimus access and refresh JWTs.

Sudomimus tokens carry the standard envelope claims (`iss`, `aud`, `iat`,
`exp`, `jti`, `kid`, `kty`) in the JWT **header**; the body holds only the
application-specific claims. The verifier checks structure, key type,
audience, expiration, and the RS256 signature against an application public
key selected from Session JWKS by application anchor and `kid`.

## Install

```bash
pip install sudomimus-token
```

## Usage

```python
from sudomimus_token import TokenVerifier

def resolve_public_key(application_anchor: str, key_id: str) -> str:
    # Fetch/cache Session JWKS and return the RSA key matching key_id.
    ...

verifier = TokenVerifier(resolve_public_key)
access = verifier.verify_access_token(jwt)
print(access.body.subject, access.body.staticAvatarUrl, access.header.aud)
```

Async callers use `AsyncTokenVerifier` with an awaitable resolver:

```python
from sudomimus_token import AsyncTokenVerifier

verifier = AsyncTokenVerifier(resolve_public_key_async)
access = await verifier.verify_access_token(jwt)
```

Verification failures raise `TokenError` with a `code` drawn from
`TokenErrorCode` (`INVALID_JWT`, `WRONG_KEY_TYPE`, `MISSING_AUDIENCE`,
`MISSING_KEY_ID`, `UNKNOWN_KEY_ID`, `EXPIRED`, `INVALID_SIGNATURE`).

For read-only inspection without trust decisions, use `parse_access_token`,
`parse_refresh_token`, or `peek_header`.

## License

[MIT](../../../../LICENSE)
