package token

import (
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"errors"
	"strings"
	"time"
)

// JWT is a parsed Sudomimus token. The raw on-wire segments are kept so
// signature verification operates on the literal bytes that were signed, not
// on a re-encoded copy of the deserialized claims.
type JWT[TBody any] struct {
	Raw          string
	SigningInput []byte
	Signature    []byte
	Header       Header
	Body         TBody
}

// VerifyExpiration returns true when the token's exp claim is in the future
// relative to now.
func (t *JWT[TBody]) VerifyExpiration(now time.Time) bool {
	if t.Header.ExpiresAt == 0 {
		return false
	}
	return now.Before(time.Unix(t.Header.ExpiresAt, 0))
}

// VerifySignature returns true when the RSA-SHA256 signature matches the
// given PEM-encoded public key.
func (t *JWT[TBody]) VerifySignature(publicKeyPEM string) bool {
	pub, err := parseRSAPublicKey(publicKeyPEM)
	if err != nil {
		return false
	}
	digest := sha256.Sum256(t.SigningInput)
	return rsa.VerifyPKCS1v15(pub, crypto.SHA256, digest[:], t.Signature) == nil
}

// ParseAccessToken parses a Sudomimus access token without verifying anything.
func ParseAccessToken(jwt string) (*AccessToken, error) {
	return parse[AccessTokenBody](jwt)
}

// ParseRefreshToken parses a Sudomimus refresh token without verifying anything.
func ParseRefreshToken(jwt string) (*RefreshToken, error) {
	return parse[RefreshTokenBody](jwt)
}

// PeekHeader decodes only the header segment. Useful for inspecting the key
// type or audience before committing to a full typed parse.
func PeekHeader(jwt string) (Header, error) {
	if jwt == "" {
		return Header{}, newError(ErrInvalidJWT, "token is empty")
	}
	parts := strings.Split(jwt, ".")
	if len(parts) != 3 {
		return Header{}, newError(ErrInvalidJWT, "token must have exactly three dot-separated segments; got %d", len(parts))
	}
	headerBytes, err := b64url.DecodeString(parts[0])
	if err != nil {
		return Header{}, newError(ErrInvalidJWT, "failed to decode JWT header segment: %s", err)
	}
	var header Header
	if err := json.Unmarshal(headerBytes, &header); err != nil {
		return Header{}, newError(ErrInvalidJWT, "failed to deserialize JWT header: %s", err)
	}
	return header, nil
}

func parse[TBody any](jwt string) (*JWT[TBody], error) {
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

	var header Header
	if err := json.Unmarshal(headerBytes, &header); err != nil {
		return nil, newError(ErrInvalidJWT, "failed to deserialize header: %s", err)
	}
	var body TBody
	if err := json.Unmarshal(bodyBytes, &body); err != nil {
		return nil, newError(ErrInvalidJWT, "failed to deserialize body: %s", err)
	}

	signingInput := []byte(parts[0] + "." + parts[1])
	return &JWT[TBody]{
		Raw:          jwt,
		SigningInput: signingInput,
		Signature:    sigBytes,
		Header:       header,
		Body:         body,
	}, nil
}

func parseRSAPublicKey(pemStr string) (*rsa.PublicKey, error) {
	block, _ := pem.Decode([]byte(pemStr))
	if block == nil {
		return nil, errors.New("no PEM block found")
	}
	switch block.Type {
	case "PUBLIC KEY":
		key, err := x509.ParsePKIXPublicKey(block.Bytes)
		if err != nil {
			return nil, err
		}
		rsaKey, ok := key.(*rsa.PublicKey)
		if !ok {
			return nil, errors.New("PEM is not an RSA public key")
		}
		return rsaKey, nil
	case "RSA PUBLIC KEY":
		return x509.ParsePKCS1PublicKey(block.Bytes)
	default:
		return nil, errors.New("unsupported PEM block type: " + block.Type)
	}
}
