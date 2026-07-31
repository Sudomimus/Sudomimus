# @sudomimus/token

TypeScript SDK for parsing and verifying [Sudomimus](https://sudomimus.com) access and refresh JWTs.

This package is for the *consumer* of a token — typically an application backend validating a bearer token on each request. It contains the typed `AccessToken` / `RefreshToken` shapes, pure parsers, a signature/expiration verifier, JWK conversion, and a `TokenError` with stable error codes. It has no HTTP client; you provide a `PublicKeyResolver` that returns an application's public key by `applicationAnchor` and JWT `kid`.

If you also need to *issue* tokens, use [`@sudomimus/connect`](../connect) for establish/redeem and [`@sudomimus/session`](../session) for refresh, introspection, logout, and account-wide session revocation.

## Install

```bash
npm install @sudomimus/token
# or
pnpm add @sudomimus/token
```

## Usage

### Parsing (no verification)

```typescript
import { parseAccessToken, parseRefreshToken } from "@sudomimus/token";

const token = parseAccessToken(jwt);
if (token !== null) {
    console.log(token.body.subject, token.body.firstName, token.body.staticAvatarUrl);
    console.log(token.header.aud); // applicationAnchor
}
```

`parseAccessToken` / `parseRefreshToken` decode without verifying anything. They return a `JWTToken` instance or `null` on malformed input.

### Verifying

```typescript
import { TokenVerifier, TokenError, type PublicKeyResolver } from "@sudomimus/token";

const resolver: PublicKeyResolver = async (applicationAnchor, keyId) => {
    // Fetch the application's JWKS and select the entry matching keyId.
    return await myCache.get(applicationAnchor, keyId);
};

const verifier = new TokenVerifier({ resolver });

try {
    const token = await verifier.verifyAccessToken(jwt);
    console.log(token.body.subject);
} catch (err) {
    if (err instanceof TokenError) {
        // Also includes MISSING_KEY_ID / UNKNOWN_KEY_ID for JWKS key selection.
    }
}
```

The verifier performs, in order:

1. JWT parse (`INVALID_JWT` on failure)
2. `kty` header matches `"Access"` / `"Refresh"` (`WRONG_KEY_TYPE`)
3. `aud` header is a non-empty string (`MISSING_AUDIENCE`)
4. `kid` identifies the signing JWK (`MISSING_KEY_ID`)
5. Expiration is in the future (`EXPIRED`)
6. Signature verifies against `resolver(aud, kid)` (`INVALID_SIGNATURE`)

The verifier does not cache resolver results — caching is the resolver's responsibility.

## Types

```typescript
import type {
    AccessToken,
    AccessTokenBody,
    AccessTokenHeader,
    RefreshToken,
    RefreshTokenBody,
    RefreshTokenHeader,
    PublicKeyResolver,
    TokenErrorCode,
} from "@sudomimus/token";
```

## License

[MIT](../../../../LICENSE)
