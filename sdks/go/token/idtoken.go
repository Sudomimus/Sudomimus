package token

import (
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/json"
	"strings"
	"time"
)

// IDTokenHeader holds the header claims of an OIDC id_token. Unlike Sudomimus
// access/refresh tokens, an id_token is a standard OIDC JWT: KeyID identifies
// the platform signing key in the OIDC JWKS.
type IDTokenHeader struct {
	Algorithm string `json:"alg,omitempty"`
	Type      string `json:"typ,omitempty"`
	KeyID     string `json:"kid,omitempty"`
}

// IDTokenBody holds the body claims of a Sudomimus OIDC id_token. Every claim
// lives in the JWT body (standard OIDC). Subject is the per-(account, sector)
// sector subject — identical to the access-token body Subject. The token is
// signed by the platform key, not by an application's signing key.
type IDTokenBody struct {
	Issuer        string   `json:"iss"`
	Subject       string   `json:"sub"`
	Audience      string   `json:"aud"`
	IssuedAt      int64    `json:"iat"`
	ExpiresAt     int64    `json:"exp"`
	AtHash        string   `json:"at_hash,omitempty"`
	Nonce         string   `json:"nonce,omitempty"`
	AuthTime      int64    `json:"auth_time,omitempty"`
	Email         string   `json:"email,omitempty"`
	EmailVerified bool     `json:"email_verified,omitempty"`
	Name          string   `json:"name,omitempty"`
	AMR           []string `json:"amr,omitempty"`
	ACR           string   `json:"acr,omitempty"`
}

// IDToken is a parsed OIDC id_token.
type IDToken struct {
	Raw          string
	SigningInput []byte
	Signature    []byte
	Header       IDTokenHeader
	Body         IDTokenBody
}

// UserInfo is the decoded response of the OIDC /userinfo endpoint. Subject is
// the same sector subject carried by the id_token; the other claims are
// scope-gated by the access token presented to /userinfo.
type UserInfo struct {
	Subject       string `json:"sub"`
	Email         string `json:"email,omitempty"`
	EmailVerified bool   `json:"email_verified,omitempty"`
	Name          string `json:"name,omitempty"`
}

// VerifySignature returns true when the RSA-SHA256 signature matches the given
// PEM-encoded public key.
func (t *IDToken) VerifySignature(publicKeyPEM string) bool {
	pub, err := parseRSAPublicKey(publicKeyPEM)
	if err != nil {
		return false
	}
	digest := sha256.Sum256(t.SigningInput)
	return rsa.VerifyPKCS1v15(pub, crypto.SHA256, digest[:], t.Signature) == nil
}

// ParseIDToken parses an id_token into its header and body without verifying.
func ParseIDToken(jwt string) (*IDToken, error) {
	if jwt == "" {
		return nil, newError(ErrInvalidJWT, "token is empty")
	}
	parts := strings.Split(jwt, ".")
	if len(parts) != 3 {
		return nil, newError(ErrInvalidJWT, "token must have exactly three dot-separated segments; got %d", len(parts))
	}

	headerBytes, err := b64url.DecodeString(parts[0])
	if err != nil {
		return nil, newError(ErrInvalidJWT, "failed to decode header segment: %s", err)
	}
	bodyBytes, err := b64url.DecodeString(parts[1])
	if err != nil {
		return nil, newError(ErrInvalidJWT, "failed to decode body segment: %s", err)
	}
	sigBytes, err := b64url.DecodeString(parts[2])
	if err != nil {
		return nil, newError(ErrInvalidJWT, "failed to decode signature segment: %s", err)
	}

	var header IDTokenHeader
	if err := json.Unmarshal(headerBytes, &header); err != nil {
		return nil, newError(ErrInvalidJWT, "failed to deserialize header: %s", err)
	}
	var body IDTokenBody
	if err := json.Unmarshal(bodyBytes, &body); err != nil {
		return nil, newError(ErrInvalidJWT, "failed to deserialize body: %s", err)
	}

	return &IDToken{
		Raw:          jwt,
		SigningInput: []byte(parts[0] + "." + parts[1]),
		Signature:    sigBytes,
		Header:       header,
		Body:         body,
	}, nil
}

// IDTokenExpectations narrows id_token verification. A zero-value field is not
// checked; a zero Now defaults to time.Now().
type IDTokenExpectations struct {
	Audience string
	Issuer   string
	Nonce    string
	Now      time.Time
}

// VerifyIDToken verifies an OIDC id_token against a platform public key
// (resolved from the OIDC JWKS). It checks the body exp, the RS256 signature,
// and any supplied audience/issuer/nonce expectations.
func VerifyIDToken(jwt, platformPublicKeyPEM string, expect IDTokenExpectations) (*IDToken, error) {
	parsed, err := ParseIDToken(jwt)
	if err != nil {
		return nil, err
	}

	now := expect.Now
	if now.IsZero() {
		now = time.Now()
	}
	if parsed.Body.ExpiresAt == 0 || !now.Before(time.Unix(parsed.Body.ExpiresAt, 0)) {
		return nil, newError(ErrExpired, "id_token has expired")
	}

	if !parsed.VerifySignature(platformPublicKeyPEM) {
		return nil, newError(ErrInvalidSignature, "id_token signature does not match the platform public key")
	}

	if expect.Audience != "" && parsed.Body.Audience != expect.Audience {
		return nil, newError(ErrWrongAudience, "id_token aud does not match the expected client id")
	}
	if expect.Issuer != "" && parsed.Body.Issuer != expect.Issuer {
		return nil, newError(ErrWrongIssuer, "id_token iss does not match the expected issuer")
	}
	if expect.Nonce != "" && parsed.Body.Nonce != expect.Nonce {
		return nil, newError(ErrWrongNonce, "id_token nonce does not match the value sent at /authorize")
	}

	return parsed, nil
}
