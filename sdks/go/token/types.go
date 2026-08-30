package token

import "context"

const (
	AccessTokenType  = "vnd.sudomimus.application-access+jwt"
	RefreshTokenType = "vnd.sudomimus.application-refresh+jwt"
	WorkloadAccessTokenType = "vnd.sudomimus.workload-access+jwt"
)

// Header is the exact JOSE protected-header shape of application tokens.
type Header struct {
	Algorithm string `json:"alg"`
	KeyID     string `json:"kid"`
	Type      string `json:"typ"`
}

// AccessTokenBody is the payload of a Sudomimus access token.
type AccessTokenBody struct {
	Issuer    string `json:"iss"`
	Audience  string `json:"aud"`
	Subject   string `json:"sub"`
	SessionID string `json:"sid"`
	JwtID     string `json:"jti"`
	IssuedAt  int64  `json:"iat"`
	ExpiresAt int64  `json:"exp"`
}

// WorkloadActor is the pairwise Agent/Automation principal represented by act.
type WorkloadActor struct {
	Subject string `json:"sub"`
}

// WorkloadAccessTokenBody binds an owner Account subject to a Workload actor.
type WorkloadAccessTokenBody struct {
	Issuer    string        `json:"iss"`
	Audience  string        `json:"aud"`
	Subject   string        `json:"sub"`
	SessionID string        `json:"sid"`
	JwtID     string        `json:"jti"`
	IssuedAt  int64         `json:"iat"`
	ExpiresAt int64         `json:"exp"`
	Actor     WorkloadActor `json:"act"`
}

// RefreshTokenBody carries session binding and rotation state, with no user
// identifier or profile data.
type RefreshTokenBody struct {
	Issuer          string `json:"iss"`
	Audience        string `json:"aud"`
	SessionID       string `json:"sid"`
	JwtID           string `json:"jti"`
	IssuedAt        int64  `json:"iat"`
	ExpiresAt       int64  `json:"exp"`
	RotationVersion int64  `json:"rotationVersion"`
}

// AccessToken is a parsed Sudomimus access token.
type AccessToken = JWT[AccessTokenBody]

// RefreshToken is a parsed Sudomimus refresh token.
type RefreshToken = JWT[RefreshTokenBody]

// WorkloadAccessToken is a parsed Agent/Automation access token.
type WorkloadAccessToken = JWT[WorkloadAccessTokenBody]

// PublicKeyResolver returns a PEM-encoded RSA public key for the given
// application anchor and key ID (the token's `aud` and `kid` claims). Caching
// is the resolver's responsibility — Verifier does not cache.
type PublicKeyResolver func(ctx context.Context, applicationAnchor, keyID string) (string, error)
