package token

import "fmt"

// ErrorCode is the categorical reason a token failed to parse or verify.
type ErrorCode string

const (
	ErrInvalidJWT       ErrorCode = "INVALID_JWT"
	ErrWrongKeyType     ErrorCode = "WRONG_KEY_TYPE"
	ErrMissingAudience  ErrorCode = "MISSING_AUDIENCE"
	ErrExpired          ErrorCode = "EXPIRED"
	ErrInvalidSignature ErrorCode = "INVALID_SIGNATURE"
)

// Error is returned by Parse* and Verifier methods.
type Error struct {
	Code    ErrorCode
	Message string
}

func (e *Error) Error() string {
	return fmt.Sprintf("sudomimus token: %s: %s", e.Code, e.Message)
}

func newError(code ErrorCode, format string, args ...any) *Error {
	return &Error{Code: code, Message: fmt.Sprintf(format, args...)}
}
