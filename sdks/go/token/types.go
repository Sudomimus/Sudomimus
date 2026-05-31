package token

import "context"

const (
	AccessKeyType  = "Access"
	RefreshKeyType = "Refresh"
)

// Header holds the standard JWT envelope claims that @sudoo/jwt places in the
// header segment. Sudomimus tokens carry these claims here, not in the body.
type Header struct {
	Algorithm string `json:"alg,omitempty"`
	Type      string `json:"typ,omitempty"`
	Issuer    string `json:"iss,omitempty"`
	Audience  string `json:"aud,omitempty"`
	IssuedAt  int64  `json:"iat,omitempty"`
	ExpiresAt int64  `json:"exp,omitempty"`
	NotBefore int64  `json:"nbf,omitempty"`
	JwtID     string `json:"jti,omitempty"`
	Subject   string `json:"sub,omitempty"`
	KeyType   string `json:"kty,omitempty"`
	Version   string `json:"ver,omitempty"`
}

// AccessTokenBody is the payload of a Sudomimus access token.
//
// Subject is the application-visible "sector subject" (also the OIDC sub) —
// the value an application keys its users on. The raw internal account
// identifier never appears in a token. It is opaque: never parse or
// format-validate it.
type AccessTokenBody struct {
	Subject      string `json:"subject"`
	FirstName    string `json:"firstName"`
	LastName     string `json:"lastName,omitempty"`
	EmailAddress string `json:"emailAddress,omitempty"`
}

// RefreshTokenBody is the payload of a Sudomimus refresh token. It carries the
// sector Subject (the same pairwise identifier as the access-token body)
// because the refresh token leaves the system and must never expose the
// internal account identifier. Informational only — /refresh resolves the
// token by its jti.
type RefreshTokenBody struct {
	Subject string `json:"subject"`
}

// AccessToken is a parsed Sudomimus access token.
type AccessToken = JWT[AccessTokenBody]

// RefreshToken is a parsed Sudomimus refresh token.
type RefreshToken = JWT[RefreshTokenBody]

// PublicKeyResolver returns a PEM-encoded RSA public key for the given
// application anchor (the token's `aud` claim). Caching is the resolver's
// responsibility — Verifier does not cache.
type PublicKeyResolver func(ctx context.Context, applicationAnchor string) (string, error)
