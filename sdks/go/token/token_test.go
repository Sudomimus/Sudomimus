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
		"alg": "RS256", "typ": "JWT", "iss": "sudomimus.com",
		"aud": anchor, "iat": iat, "exp": iat + 3600,
		"jti": "access-1", "kty": "Access", "sub": "refresh-1",
	}
	body := map[string]any{
		"subject":      "subject-1",
		"firstName":    "Ada",
		"lastName":     "Lovelace",
		"emailAddress": "ada@example.com",
		"avatarUrl":    "https://cdn.sudomimus.com/avatar/subject-1.png",
	}
	return mintToken(t, header, body, priv)
}

func mintRefreshToken(t *testing.T, priv *rsa.PrivateKey, anchor string) string {
	iat := time.Now().Unix()
	header := map[string]any{
		"alg": "RS256", "typ": "JWT", "iss": "sudomimus.com",
		"aud": anchor, "iat": iat, "exp": iat + 30*24*3600,
		"jti": "refresh-1", "kty": "Refresh",
	}
	body := map[string]any{"subject": "subject-1"}
	return mintToken(t, header, body, priv)
}

func staticResolver(pem string) PublicKeyResolver {
	return func(_ context.Context, _ string) (string, error) { return pem, nil }
}

func TestVerifyAccessToken_RoundTrip(t *testing.T) {
	keys := generateRSAKeyPair(t)
	jwt := mintAccessToken(t, keys.privateKey, "anchor-1")

	v := NewVerifier(staticResolver(keys.publicPEM))
	tok, err := v.VerifyAccessToken(context.Background(), jwt)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if tok.Body.Subject != "subject-1" ||
		tok.Body.FirstName != "Ada" ||
		tok.Body.AvatarURL != "https://cdn.sudomimus.com/avatar/subject-1.png" {
		t.Fatalf("unexpected body: %+v", tok.Body)
	}
}

func TestVerifyAccessToken_ConsentGatedClaimsAbsent(t *testing.T) {
	// firstName / lastName / emailAddress / avatarUrl are consent-gated and may
	// be absent; a token carrying only `subject` must still verify.
	keys := generateRSAKeyPair(t)
	iat := time.Now().Unix()
	header := map[string]any{
		"alg": "RS256", "typ": "JWT", "iss": "sudomimus.com",
		"aud": "anchor-1", "iat": iat, "exp": iat + 3600,
		"jti": "access-1", "kty": "Access", "sub": "refresh-1",
	}
	jwt := mintToken(t, header, map[string]any{"subject": "subject-1"}, keys.privateKey)

	v := NewVerifier(staticResolver(keys.publicPEM))
	tok, err := v.VerifyAccessToken(context.Background(), jwt)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if tok.Body.Subject != "subject-1" ||
		tok.Body.FirstName != "" ||
		tok.Body.EmailAddress != "" ||
		tok.Body.AvatarURL != "" {
		t.Fatalf("unexpected body: %+v", tok.Body)
	}
}

func TestVerifyRefreshToken_RoundTrip(t *testing.T) {
	keys := generateRSAKeyPair(t)
	jwt := mintRefreshToken(t, keys.privateKey, "anchor-1")

	v := NewVerifier(staticResolver(keys.publicPEM))
	tok, err := v.VerifyRefreshToken(context.Background(), jwt)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if tok.Body.Subject != "subject-1" {
		t.Fatalf("unexpected body: %+v", tok.Body)
	}
}

func TestVerifyAccessToken_WrongKeyType(t *testing.T) {
	keys := generateRSAKeyPair(t)
	jwt := mintRefreshToken(t, keys.privateKey, "anchor-1")

	v := NewVerifier(staticResolver(keys.publicPEM))
	_, err := v.VerifyAccessToken(context.Background(), jwt)
	assertCode(t, err, ErrWrongKeyType)
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
		"alg": "RS256", "typ": "JWT",
		"iat": int64(0), "exp": int64(1 << 62), "kty": "Access",
	}
	body := map[string]any{"subject": "subject-1", "firstName": "Ada"}
	jwt := mintToken(t, header, body, keys.privateKey)

	v := NewVerifier(staticResolver(keys.publicPEM))
	_, err := v.VerifyAccessToken(context.Background(), jwt)
	assertCode(t, err, ErrMissingAudience)
}

func TestVerifyAccessToken_PassesAudienceToResolver(t *testing.T) {
	keys := generateRSAKeyPair(t)
	jwt := mintAccessToken(t, keys.privateKey, "anchor-zzz")

	var seen string
	v := NewVerifier(func(_ context.Context, anchor string) (string, error) {
		seen = anchor
		return keys.publicPEM, nil
	})
	if _, err := v.VerifyAccessToken(context.Background(), jwt); err != nil {
		t.Fatalf("verify: %v", err)
	}
	if seen != "anchor-zzz" {
		t.Fatalf("resolver got %q, want %q", seen, "anchor-zzz")
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
