package token

import (
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"errors"
	"io"
	"net/url"
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
	var expiresAt int64
	switch body := any(t.Body).(type) {
	case AccessTokenBody:
		expiresAt = body.ExpiresAt
	case RefreshTokenBody:
		expiresAt = body.ExpiresAt
	}
	if expiresAt == 0 {
		return false
	}
	return now.Before(time.Unix(expiresAt, 0))
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
	return parse(jwt, AccessTokenType, validateAccessTokenBody)
}

// ParseRefreshToken parses a Sudomimus refresh token without verifying anything.
func ParseRefreshToken(jwt string) (*RefreshToken, error) {
	return parse(jwt, RefreshTokenType, validateRefreshTokenBody)
}

// PeekHeader decodes only the header segment. Useful for inspecting the key
// media type before committing to a full typed parse.
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
	if err := decodeExactJSON(headerBytes, &header); err != nil {
		return Header{}, newError(ErrInvalidJWT, "failed to deserialize JWT header: %s", err)
	}
	return header, nil
}

func parse[TBody any](
	jwt string,
	expectedTokenType string,
	validateBody func(TBody) error,
) (*JWT[TBody], error) {
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
	if err := decodeExactJSON(headerBytes, &header); err != nil {
		return nil, newError(ErrInvalidJWT, "failed to deserialize header: %s", err)
	}
	var body TBody
	if err := decodeExactJSON(bodyBytes, &body); err != nil {
		return nil, newError(ErrInvalidJWT, "failed to deserialize body: %s", err)
	}
	if err := validateHeader(header, expectedTokenType); err != nil {
		return nil, newError(ErrInvalidJWT, "protected header does not match the 4.0.0 contract: %s", err)
	}
	if err := validateBody(body); err != nil {
		return nil, newError(ErrInvalidJWT, "payload does not match the 4.0.0 contract: %s", err)
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

func decodeExactJSON(data []byte, target any) error {
	decoder := json.NewDecoder(strings.NewReader(string(data)))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		if err == nil {
			return errors.New("JSON contains more than one value")
		}
		return err
	}
	return nil
}

func peekAudience(jwt string) (string, error) {
	parts := strings.Split(jwt, ".")
	if len(parts) != 3 {
		return "", newError(ErrInvalidJWT, "token must have exactly three dot-separated segments; got %d", len(parts))
	}
	bodyBytes, err := b64url.DecodeString(parts[1])
	if err != nil {
		return "", newError(ErrInvalidJWT, "failed to decode JWT body segment: %s", err)
	}
	var body map[string]json.RawMessage
	if err := decodeExactJSON(bodyBytes, &body); err != nil {
		return "", newError(ErrInvalidJWT, "failed to deserialize JWT body: %s", err)
	}
	var audience string
	if raw, ok := body["aud"]; ok {
		_ = json.Unmarshal(raw, &audience)
	}
	return audience, nil
}

func validateHeader(header Header, expectedTokenType string) error {
	if header.Algorithm != "RS256" {
		return errors.New("alg must be RS256")
	}
	if header.Type != expectedTokenType {
		return errors.New("typ does not match the token kind")
	}
	if header.KeyID == "" {
		return errors.New("kid must be non-empty")
	}
	return nil
}

func validateAccessTokenBody(body AccessTokenBody) error {
	if !isAbsoluteURI(body.Issuer) || body.Audience == "" || body.Subject == "" ||
		body.SessionID == "" || body.JwtID == "" || body.IssuedAt < 0 || body.ExpiresAt < 1 {
		return errors.New("access-token claims are missing or out of range")
	}
	return nil
}

func validateRefreshTokenBody(body RefreshTokenBody) error {
	if !isAbsoluteURI(body.Issuer) || body.Audience == "" || body.SessionID == "" ||
		body.JwtID == "" || body.IssuedAt < 0 || body.ExpiresAt < 1 || body.RotationVersion < 1 {
		return errors.New("refresh-token claims are missing or out of range")
	}
	return nil
}

func isAbsoluteURI(value string) bool {
	parsed, err := url.Parse(value)
	return err == nil && parsed.IsAbs()
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
