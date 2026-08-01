package token

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"errors"
	"testing"
	"time"
)

type rsaKeyPair struct {
	publicPEM  string
	privateKey *rsa.PrivateKey
}

func generateRSAKeyPair(t *testing.T) rsaKeyPair {
	t.Helper()
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate rsa key: %v", err)
	}
	pubBytes, err := x509.MarshalPKIXPublicKey(&priv.PublicKey)
	if err != nil {
		t.Fatalf("marshal public key: %v", err)
	}
	pubPEM := pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: pubBytes})
	return rsaKeyPair{publicPEM: string(pubPEM), privateKey: priv}
}

func mintToken(t *testing.T, header any, body any, priv *rsa.PrivateKey) string {
	t.Helper()
	headerJSON, err := json.Marshal(header)
	if err != nil {
		t.Fatalf("marshal header: %v", err)
	}
	bodyJSON, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal body: %v", err)
	}
	headerSeg := b64url.EncodeToString(headerJSON)
	bodySeg := b64url.EncodeToString(bodyJSON)
	signingInput := headerSeg + "." + bodySeg
	digest := sha256.Sum256([]byte(signingInput))
	sig, err := rsa.SignPKCS1v15(rand.Reader, priv, crypto.SHA256, digest[:])
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	return signingInput + "." + b64url.EncodeToString(sig)
}

func mintAccessToken(t *testing.T, priv *rsa.PrivateKey, anchor string) string {
	iat := time.Now().Unix()
	header := map[string]any{
		"alg": "RS256", "typ": AccessTokenType, "kid": "key-1",
	}
	body := map[string]any{
		"iss": "https://connect-api.sudomimus.com", "aud": anchor,
		"sub": "subject-1", "sid": "session-1", "jti": "access-1",
		"iat": iat, "exp": iat + 3600,
	}
	return mintToken(t, header, body, priv)
}

func mintRefreshToken(t *testing.T, priv *rsa.PrivateKey, anchor string) string {
	iat := time.Now().Unix()
	header := map[string]any{
		"alg": "RS256", "typ": RefreshTokenType, "kid": "key-1",
	}
	body := map[string]any{
		"iss": "https://connect-api.sudomimus.com", "aud": anchor,
		"sid": "session-1", "jti": "refresh-1", "iat": iat,
		"exp": iat + 30*24*3600, "rotationVersion": 1,
	}
	return mintToken(t, header, body, priv)
}

func staticResolver(pem string) PublicKeyResolver {
	return func(_ context.Context, _, _ string) (string, error) { return pem, nil }
}

func TestVerifyAccessToken_RoundTrip(t *testing.T) {
	keys := generateRSAKeyPair(t)
	jwt := mintAccessToken(t, keys.privateKey, "anchor-1")

	v := NewVerifier(staticResolver(keys.publicPEM))
	tok, err := v.VerifyAccessToken(context.Background(), jwt)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if tok.Body.Subject != "subject-1" || tok.Body.SessionID != "session-1" {
		t.Fatalf("unexpected body: %+v", tok.Body)
	}
}

func TestVerifyAccessToken_RejectsProfileClaims(t *testing.T) {
	keys := generateRSAKeyPair(t)
	iat := time.Now().Unix()
	header := map[string]any{
		"alg": "RS256", "typ": AccessTokenType, "kid": "key-1",
	}
	body := map[string]any{
		"iss": "https://connect-api.sudomimus.com", "aud": "anchor-1",
		"sub": "subject-1", "sid": "session-1", "jti": "access-1",
		"iat": iat, "exp": iat + 3600, "firstName": "Ada",
	}
	jwt := mintToken(t, header, body, keys.privateKey)

	v := NewVerifier(staticResolver(keys.publicPEM))
	_, err := v.VerifyAccessToken(context.Background(), jwt)
	assertCode(t, err, ErrInvalidJWT)
}

func TestVerifyRefreshToken_RoundTrip(t *testing.T) {
	keys := generateRSAKeyPair(t)
	jwt := mintRefreshToken(t, keys.privateKey, "anchor-1")

	v := NewVerifier(staticResolver(keys.publicPEM))
	tok, err := v.VerifyRefreshToken(context.Background(), jwt)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if tok.Body.SessionID != "session-1" || tok.Body.RotationVersion != 1 {
		t.Fatalf("unexpected body: %+v", tok.Body)
	}
}

func TestVerifyAccessToken_WrongTokenType(t *testing.T) {
	keys := generateRSAKeyPair(t)
	jwt := mintRefreshToken(t, keys.privateKey, "anchor-1")

	v := NewVerifier(staticResolver(keys.publicPEM))
	_, err := v.VerifyAccessToken(context.Background(), jwt)
	assertCode(t, err, ErrWrongTokenType)
}

func TestVerifyAccessToken_InvalidSignature(t *testing.T) {
	signer := generateRSAKeyPair(t)
	other := generateRSAKeyPair(t)
	jwt := mintAccessToken(t, signer.privateKey, "anchor-1")

	v := NewVerifier(staticResolver(other.publicPEM))
	_, err := v.VerifyAccessToken(context.Background(), jwt)
	assertCode(t, err, ErrInvalidSignature)
}

func TestVerifyAccessToken_Expired(t *testing.T) {
	keys := generateRSAKeyPair(t)
	jwt := mintAccessToken(t, keys.privateKey, "anchor-1")

	v := NewVerifier(staticResolver(keys.publicPEM))
	v.Now = func() time.Time { return time.Now().Add(2 * time.Hour) }
	_, err := v.VerifyAccessToken(context.Background(), jwt)
	assertCode(t, err, ErrExpired)
}

func TestVerifyAccessToken_MissingAudience(t *testing.T) {
	keys := generateRSAKeyPair(t)
	header := map[string]any{
		"alg": "RS256", "typ": AccessTokenType, "kid": "key-1",
	}
	body := map[string]any{
		"iss": "https://connect-api.sudomimus.com", "sub": "subject-1",
		"sid": "session-1", "jti": "access-1", "iat": int64(0), "exp": int64(1 << 62),
	}
	jwt := mintToken(t, header, body, keys.privateKey)

	v := NewVerifier(staticResolver(keys.publicPEM))
	_, err := v.VerifyAccessToken(context.Background(), jwt)
	assertCode(t, err, ErrMissingAudience)
}

func TestVerifyAccessToken_MissingKeyID(t *testing.T) {
	keys := generateRSAKeyPair(t)
	iat := time.Now().Unix()
	header := map[string]any{
		"alg": "RS256", "typ": AccessTokenType,
	}
	body := map[string]any{
		"iss": "https://connect-api.sudomimus.com", "aud": "anchor-1",
		"sub": "subject-1", "sid": "session-1", "jti": "access-1",
		"iat": iat, "exp": iat + 3600,
	}
	jwt := mintToken(t, header, body, keys.privateKey)

	v := NewVerifier(staticResolver(keys.publicPEM))
	_, err := v.VerifyAccessToken(context.Background(), jwt)
	assertCode(t, err, ErrMissingKeyID)
}

func TestVerifyAccessToken_PassesAudienceAndKeyIDToResolver(t *testing.T) {
	keys := generateRSAKeyPair(t)
	jwt := mintAccessToken(t, keys.privateKey, "anchor-zzz")

	var seenAnchor, seenKeyID string
	v := NewVerifier(func(_ context.Context, anchor, keyID string) (string, error) {
		seenAnchor = anchor
		seenKeyID = keyID
		return keys.publicPEM, nil
	})
	if _, err := v.VerifyAccessToken(context.Background(), jwt); err != nil {
		t.Fatalf("verify: %v", err)
	}
	if seenAnchor != "anchor-zzz" || seenKeyID != "key-1" {
		t.Fatalf("resolver got (%q, %q), want (%q, %q)", seenAnchor, seenKeyID, "anchor-zzz", "key-1")
	}
}

func TestParseAccessToken_InvalidJWT(t *testing.T) {
	_, err := ParseAccessToken("not-a-jwt")
	assertCode(t, err, ErrInvalidJWT)
}

func assertCode(t *testing.T, err error, want ErrorCode) {
	t.Helper()
	if err == nil {
		t.Fatalf("expected error %q, got nil", want)
	}
	var te *Error
	if !errors.As(err, &te) {
		t.Fatalf("expected *Error, got %T: %v", err, err)
	}
	if te.Code != want {
		t.Fatalf("expected code %q, got %q (%v)", want, te.Code, err)
	}
}
