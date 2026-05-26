package token

import (
	"context"
	"time"
)

// Verifier verifies Sudomimus access and refresh tokens end-to-end:
// structural integrity, expected key type, audience presence, expiration, and
// RSA signature against a caller-supplied public key.
type Verifier struct {
	Resolver PublicKeyResolver
	// Now overrides the clock for tests. Defaults to time.Now.
	Now func() time.Time
}

// NewVerifier returns a Verifier with the default clock.
func NewVerifier(resolver PublicKeyResolver) *Verifier {
	return &Verifier{Resolver: resolver}
}

// VerifyAccessToken parses and verifies a Sudomimus access token.
func (v *Verifier) VerifyAccessToken(ctx context.Context, jwt string) (*AccessToken, error) {
	parsed, err := verifyWith[AccessTokenBody](ctx, v, jwt, AccessKeyType, ParseAccessToken)
	return parsed, err
}

// VerifyRefreshToken parses and verifies a Sudomimus refresh token.
func (v *Verifier) VerifyRefreshToken(ctx context.Context, jwt string) (*RefreshToken, error) {
	parsed, err := verifyWith[RefreshTokenBody](ctx, v, jwt, RefreshKeyType, ParseRefreshToken)
	return parsed, err
}

func verifyWith[TBody any](
	ctx context.Context,
	v *Verifier,
	jwt string,
	expectedKeyType string,
	parser func(string) (*JWT[TBody], error),
) (*JWT[TBody], error) {
	// Peek header first so a wrong-type token surfaces as WrongKeyType rather
	// than InvalidJWT (a refresh body has no firstName, which would otherwise
	// fail to deserialize against AccessTokenBody).
	peeked, err := PeekHeader(jwt)
	if err != nil {
		return nil, err
	}
	if peeked.KeyType != expectedKeyType {
		return nil, newError(ErrWrongKeyType, "expected key type %q, got %q", expectedKeyType, peeked.KeyType)
	}

	parsed, err := parser(jwt)
	if err != nil {
		return nil, err
	}
	if parsed.Header.Audience == "" {
		return nil, newError(ErrMissingAudience, "token is missing the `aud` (applicationAnchor) header")
	}

	now := time.Now
	if v.Now != nil {
		now = v.Now
	}
	if !parsed.VerifyExpiration(now()) {
		return nil, newError(ErrExpired, "token has expired")
	}

	publicKey, err := v.Resolver(ctx, parsed.Header.Audience)
	if err != nil {
		return nil, err
	}
	if !parsed.VerifySignature(publicKey) {
		return nil, newError(ErrInvalidSignature, "token signature does not match the application public key")
	}
	return parsed, nil
}
