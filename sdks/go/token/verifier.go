package token

import (
	"context"
	"time"
)

// Verifier verifies Sudomimus access and refresh tokens end-to-end:
// structural integrity, expected token media type, audience and key ID presence,
// expiration, and RSA signature against a caller-supplied public key.
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
	parsed, err := verifyWith[AccessTokenBody](ctx, v, jwt, AccessTokenType, ParseAccessToken)
	return parsed, err
}

// VerifyRefreshToken parses and verifies a Sudomimus refresh token.
func (v *Verifier) VerifyRefreshToken(ctx context.Context, jwt string) (*RefreshToken, error) {
	parsed, err := verifyWith[RefreshTokenBody](ctx, v, jwt, RefreshTokenType, ParseRefreshToken)
	return parsed, err
}

func verifyWith[TBody any](
	ctx context.Context,
	v *Verifier,
	jwt string,
	expectedTokenType string,
	parser func(string) (*JWT[TBody], error),
) (*JWT[TBody], error) {
	// Peek header first so a wrong-type token surfaces as WrongTokenType.
	peeked, err := PeekHeader(jwt)
	if err != nil {
		return nil, err
	}
	if peeked.Type != expectedTokenType {
		return nil, newError(ErrWrongTokenType, "expected token type %q, got %q", expectedTokenType, peeked.Type)
	}

	audience, err := peekAudience(jwt)
	if err != nil {
		return nil, err
	}
	if audience == "" {
		return nil, newError(ErrMissingAudience, "token is missing the `aud` (applicationAnchor) payload claim")
	}
	if peeked.KeyID == "" {
		return nil, newError(ErrMissingKeyID, "token is missing the `kid` header")
	}

	parsed, err := parser(jwt)
	if err != nil {
		return nil, err
	}

	now := time.Now
	if v.Now != nil {
		now = v.Now
	}
	if !parsed.VerifyExpiration(now()) {
		return nil, newError(ErrExpired, "token has expired")
	}

	publicKey, err := v.Resolver(ctx, audience, peeked.KeyID)
	if err != nil {
		return nil, err
	}
	if !parsed.VerifySignature(publicKey) {
		return nil, newError(ErrInvalidSignature, "token signature does not match the application public key")
	}
	return parsed, nil
}
