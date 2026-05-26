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
type AccessTokenBody struct {
	AccountIdentifier string `json:"accountIdentifier"`
	FirstName         string `json:"firstName"`
	LastName          string `json:"lastName,omitempty"`
}

// RefreshTokenBody is the payload of a Sudomimus refresh token.
type RefreshTokenBody struct {
	AccountIdentifier string `json:"accountIdentifier"`
}

// AccessToken is a parsed Sudomimus access token.
type AccessToken = JWT[AccessTokenBody]

// RefreshToken is a parsed Sudomimus refresh token.
type RefreshToken = JWT[RefreshTokenBody]

// PublicKeyResolver returns a PEM-encoded RSA public key for the given
// application anchor (the token's `aud` claim). Caching is the resolver's
// responsibility — Verifier does not cache.
type PublicKeyResolver func(ctx context.Context, applicationAnchor string) (string, error)
