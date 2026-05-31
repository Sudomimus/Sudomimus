package token

import (
	"crypto/rsa"
	"testing"
	"time"
)

func mintIDToken(t *testing.T, priv *rsa.PrivateKey, overrides map[string]any) string {
	t.Helper()
	iat := time.Now().Unix()
	header := map[string]any{"alg": "RS256", "typ": "JWT", "kid": "platform-1"}
	body := map[string]any{
		"iss":            "https://oidc.sudomimus.com",
		"sub":            "subject-1",
		"aud":            "client-1",
		"iat":            iat,
		"exp":            iat + 3600,
		"email":          "ada@example.com",
		"email_verified": true,
		"name":           "Ada Lovelace",
	}
	for k, v := range overrides {
		body[k] = v
	}
	return mintToken(t, header, body, priv)
}

func TestParseIDToken_ExposesBody(t *testing.T) {
	keys := generateRSAKeyPair(t)
	tok, err := ParseIDToken(mintIDToken(t, keys.privateKey, nil))
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if tok.Body.Subject != "subject-1" || tok.Body.Email != "ada@example.com" {
		t.Fatalf("unexpected body: %+v", tok.Body)
	}
	if tok.Header.KeyID != "platform-1" {
		t.Fatalf("unexpected kid: %q", tok.Header.KeyID)
	}
}

func TestVerifyIDToken_HappyPath(t *testing.T) {
	keys := generateRSAKeyPair(t)
	jwt := mintIDToken(t, keys.privateKey, map[string]any{"nonce": "n-1"})
	tok, err := VerifyIDToken(jwt, keys.publicPEM, IDTokenExpectations{
		Audience: "client-1",
		Issuer:   "https://oidc.sudomimus.com",
		Nonce:    "n-1",
	})
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if tok.Body.Subject != "subject-1" {
		t.Fatalf("unexpected subject: %q", tok.Body.Subject)
	}
}

func TestVerifyIDToken_Expired(t *testing.T) {
	keys := generateRSAKeyPair(t)
	past := time.Now().Unix() - 10
	jwt := mintIDToken(t, keys.privateKey, map[string]any{"iat": past - 3600, "exp": past})
	_, err := VerifyIDToken(jwt, keys.publicPEM, IDTokenExpectations{})
	assertCode(t, err, ErrExpired)
}

func TestVerifyIDToken_WrongSignature(t *testing.T) {
	keys := generateRSAKeyPair(t)
	other := generateRSAKeyPair(t)
	jwt := mintIDToken(t, keys.privateKey, nil)
	_, err := VerifyIDToken(jwt, other.publicPEM, IDTokenExpectations{})
	assertCode(t, err, ErrInvalidSignature)
}

func TestVerifyIDToken_WrongNonce(t *testing.T) {
	keys := generateRSAKeyPair(t)
	jwt := mintIDToken(t, keys.privateKey, map[string]any{"nonce": "n-1"})
	_, err := VerifyIDToken(jwt, keys.publicPEM, IDTokenExpectations{Nonce: "n-2"})
	assertCode(t, err, ErrWrongNonce)
}
