# Sudomimus Go SDK

Go SDKs for the [Sudomimus](https://sudomimus.com) authentication and authorization platform.

Module path: `github.com/sudomimus/sudomimus-go/v4`

> The module path is forward-compatible with publishing this SDK from its own
> repository (`github.com/sudomimus/sudomimus-go`) — that's the standard Go
> convention. While it still lives in this monorepo at `sdks/go/`, you can
> consume it via a `replace` directive or after the eventual mirror push.

## Status

| Package | Purpose | Status |
| --- | --- | --- |
| `github.com/sudomimus/sudomimus-go/v4/token` | Parse and verify Sudomimus access / refresh JWTs | alpha |
| `github.com/sudomimus/sudomimus-go/v4/connect` | Browser inquiry establish / status / redeem / info | planned |
| `github.com/sudomimus/sudomimus-go/v4/session` | Refresh-token session lifecycle | planned |
| `github.com/sudomimus/sudomimus-go/v4/native` | Direct-issue (Steam ticket / access key) | planned |

## Install

```bash
go get github.com/sudomimus/sudomimus-go/v4/token
```

## Usage

```go
import (
    "context"

    "github.com/sudomimus/sudomimus-go/v4/token"
)

verifier := token.NewVerifier(func(ctx context.Context, applicationAnchor, keyID string) (string, error) {
    // Fetch/cache Session JWKS and return the PEM key matching keyID.
    return myCache.Get(applicationAnchor, keyID)
})

tok, err := verifier.VerifyAccessToken(ctx, jwt)
if err != nil {
    var terr *token.Error
    if errors.As(err, &terr) {
        // Also includes MISSING_KEY_ID / UNKNOWN_KEY_ID for JWKS selection.
    }
    return err
}
fmt.Println(tok.Body.Subject, tok.Body.SessionID, tok.Body.Audience)
```

The verifier performs, in order: parse → `typ` matches the Sudomimus
access/refresh media type → payload `aud` and header `kid` are non-empty →
expiration in the future → RSA-SHA256 signature
against `resolver(aud, kid)`. `ApplicationJSONWebKey.PublicKeyPEM` converts
Session RSA JWKs for the resolver. The verifier does not cache results.

## Development

```bash
make compile-go        # go build ./...
make test-go           # go test ./...
make coverage-go       # go test ./... -coverprofile=coverage.out
```
