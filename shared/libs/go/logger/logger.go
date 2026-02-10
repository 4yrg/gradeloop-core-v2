package logger

import (
	"context"
	"log/slog"
	"os"
	"strings"

	"github.com/google/uuid"
)

type contextKey string

const (
	// TraceIDKey is the context key used to store and retrieve the trace ID.
	TraceIDKey contextKey = "trace_id"
)

// sensitiveFields defines a set of keys whose values should be redacted for security and PII compliance.
var sensitiveFields = map[string]struct{}{
	"password":      {},
	"password_hash": {},
	"token":         {},
	"token_hash":    {},
	"secret":        {},
	"api_key":       {},
	"ssn":           {},
	"credit_card":   {},
	"email":         {},
	"phone_number":  {},
	"address":       {},
	"authorization": {},
}

// New creates a new structured logger configured for the GradeLoop ecosystem.
// It enforces a JSON format, standardizes the schema, and implements automatic redaction.
func New(serviceName string) *slog.Logger {
	opts := &slog.HandlerOptions{
		Level: slog.LevelInfo,
		ReplaceAttr: func(groups []string, a slog.Attr) slog.Attr {
			// Handle redaction of sensitive fields
			key := strings.ToLower(a.Key)
			if _, ok := sensitiveFields[key]; ok {
				return slog.String(a.Key, "[REDACTED]")
			}

			// Map attributes to the mandatory GradeLoop schema
			switch a.Key {
			case slog.TimeKey:
				return slog.Attr{Key: "timestamp", Value: a.Value}
			case slog.LevelKey:
				return slog.Attr{Key: "level", Value: a.Value}
			case slog.MessageKey:
				return slog.Attr{Key: "msg", Value: a.Value}
			}

			return a
		},
	}

	// Use os.Stdout for standard output as required for log aggregation.
	// slog.JSONHandler is high-performance and safe for concurrent use.
	handler := slog.NewJSONHandler(os.Stdout, opts)

	return slog.New(handler).With("service_name", serviceName)
}

// WithContext extracts the trace_id from the context and returns a logger enriched with it.
// If a trace_id is missing (e.g., background jobs or internal tasks), it generates
// a unique internal ID to ensure all log entries maintain the mandatory schema.
func WithContext(ctx context.Context, logger *slog.Logger) *slog.Logger {
	if ctx == nil {
		return logger.With("trace_id", "internal-"+uuid.New().String())
	}

	traceID, ok := ctx.Value(TraceIDKey).(string)
	if !ok || traceID == "" {
		// Fallback for internal jobs or missing headers
		traceID = "internal-" + uuid.New().String()
	}

	return logger.With("trace_id", traceID)
}

// FromCtx is a helper that retrieves the trace_id from context as a string.
func FromCtx(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	if id, ok := ctx.Value(TraceIDKey).(string); ok {
		return id
	}
	return ""
}
