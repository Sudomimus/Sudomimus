package token

import (
	"encoding/base64"
	"math/big"
	"testing"
)

func TestApplicationJSONWebKey_PublicKeyPEM(t *testing.T) {
	keys := generateRSAKeyPair(t)
	jwk := ApplicationJSONWebKey{
		KeyType:   "RSA",
		Use:       "sig",
		Algorithm: "RS256",
		KeyID:     "key-1",
		Modulus:   base64.RawURLEncoding.EncodeToString(keys.privateKey.PublicKey.N.Bytes()),
		Exponent:  base64.RawURLEncoding.EncodeToString(big.NewInt(int64(keys.privateKey.PublicKey.E)).Bytes()),
	}

	got, err := jwk.PublicKeyPEM()
	if err != nil {
		t.Fatalf("convert JWK: %v", err)
	}
	if got != keys.publicPEM {
		t.Fatalf("converted PEM does not match generated public key")
	}
}

func TestApplicationJSONWebKey_PublicKeyPEMRejectsNonRSA(t *testing.T) {
	_, err := (ApplicationJSONWebKey{KeyType: "EC"}).PublicKeyPEM()
	if err == nil {
		t.Fatal("expected unsupported key type error")
	}
}
