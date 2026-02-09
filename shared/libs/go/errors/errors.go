package errors

import (
	"fmt"
)

// AppError represents a domain-specific error.
type AppError struct {
	Code    string
	Message string
	Err     error
}

func (e *AppError) Error() string {
	return e.Message
}

func (e *AppError) Unwrap() error {
	return e.Err
}

// NotFound creates a NOT_FOUND error.
func NotFound(resource string) *AppError {
	return &AppError{
		Code:    "NOT_FOUND",
		Message: fmt.Sprintf("%s not found", resource),
	}
}

// ValidationError creates a VALIDATION_ERROR.
func ValidationError(msg string) *AppError {
	return &AppError{
		Code:    "VALIDATION_ERROR",
		Message: msg,
	}
}

// Internal creates an INTERNAL_ERROR.
func Internal(err error) *AppError {
	return &AppError{
		Code:    "INTERNAL_ERROR",
		Message: "internal server error",
		Err:     err,
	}
}
