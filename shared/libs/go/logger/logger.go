package logger

import (
	"context"
	"log/slog"
	"os"
)

type contextKey string

const (
	requestIDKey contextKey = "request_id"
)

// New creates a new structured logger with the service name attached.
func New(serviceName string) *slog.Logger {
	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})

	logger := slog.New(handler)

	return logger.With("service", serviceName)
}

// WithContext adds context values (like request_id) to the logger.
func WithContext(ctx context.Context, logger *slog.Logger) *slog.Logger {
	if reqID, ok := ctx.Value(requestIDKey).(string); ok {
		return logger.With("request_id", reqID)
	}
	return logger
}
