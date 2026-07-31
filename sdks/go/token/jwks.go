package token

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"fmt"
	"math/big"
)

// ApplicationJSONWebKey is an RSA public key returned by the Session JWKS
// endpoint.
type ApplicationJSONWebKey struct {
	KeyType   string `json:"kty"`
	Use       string `json:"use"`
	Algorithm string `json:"alg"`
	KeyID     string `json:"kid"`
	Modulus   string `json:"n"`
	Exponent  string `json:"e"`
}

// ApplicationJWKS is the response returned by the Session JWKS endpoint.
type ApplicationJWKS struct {
	Keys []ApplicationJSONWebKey `json:"keys"`
}

// PublicKeyPEM converts an RSA JWK into a PKIX PEM public key accepted by the
// token verifier.
func (jwk ApplicationJSONWebKey) PublicKeyPEM() (string, error) {
	if jwk.KeyType != "RSA" {
		return "", fmt.Errorf("sudomimus token: unsupported JWK key type %q", jwk.KeyType)
	}
	modulus, err := base64.RawURLEncoding.DecodeString(jwk.Modulus)
	if err != nil || len(modulus) == 0 {
		return "", fmt.Errorf("sudomimus token: invalid JWK modulus")
	}
	exponentBytes, err := base64.RawURLEncoding.DecodeString(jwk.Exponent)
	if err != nil || len(exponentBytes) == 0 {
		return "", fmt.Errorf("sudomimus token: invalid JWK exponent")
	}
	exponent := new(big.Int).SetBytes(exponentBytes)
	if exponent.Sign() <= 0 || exponent.BitLen() > 31 {
		return "", fmt.Errorf("sudomimus token: invalid JWK exponent")
	}

	der, err := x509.MarshalPKIXPublicKey(&rsa.PublicKey{
		N: new(big.Int).SetBytes(modulus),
		E: int(exponent.Int64()),
	})
	if err != nil {
		return "", fmt.Errorf("sudomimus token: encode JWK public key: %w", err)
	}
	return string(pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: der})), nil
}
