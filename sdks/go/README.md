# Sudomimus Go SDK

Go SDKs for the [Sudomimus](https://sudomimus.com) authentication and authorization platform.

Module path: `github.com/sudomimus/sudomimus-go`

> The module path is forward-compatible with publishing this SDK from its own
> repository (`github.com/sudomimus/sudomimus-go`) — that's the standard Go
> convention. While it still lives in this monorepo at `sdks/go/`, you can
> consume it via a `replace` directive or after the eventual mirror push.

## Status

| Package | Purpose | Status |
| --- | --- | --- |
| `github.com/sudomimus/sudomimus-go/token` | Parse and verify Sudomimus access / refresh JWTs | alpha |
| `github.com/sudomimus/sudomimus-go/connect` | Token exchange (Establish / Redeem / Refresh / …) | planned |
| `github.com/sudomimus/sudomimus-go/native` | Direct-issue (Steam ticket / access key) | planned |

## Install

```bash
go get github.com/sudomimus/sudomimus-go/token
```

## Usage

```go
import (
    "context"

    "github.com/sudomimus/sudomimus-go/token"
)

verifier := token.NewVerifier(func(ctx context.Context, applicationAnchor string) (string, error) {
    // Return the PEM-encoded RSA public key for this application.
    return myCache.Get(applicationAnchor)
})

tok, err := verifier.VerifyAccessToken(ctx, jwt)
if err != nil {
    var terr *token.Error
    if errors.As(err, &terr) {
        // terr.Code: INVALID_JWT | WRONG_KEY_TYPE | MISSING_AUDIENCE | EXPIRED | INVALID_SIGNATURE
    }
    return err
}
fmt.Println(tok.Body.AccountIdentifier, tok.Body.FirstName)
```

The verifier performs, in order: parse → `kty` matches `"Access"`/`"Refresh"`
→ `aud` non-empty → expiration in the future → RSA-SHA256 signature against
`resolver(aud)`. The verifier does not cache resolver results.

## Development

```bash
make compile-go        # go build ./...
make test-go           # go test ./...
make coverage-go       # go test ./... -coverprofile=coverage.out
```
