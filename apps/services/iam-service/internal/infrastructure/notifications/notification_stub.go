package notifications

import (
	"context"
	"log/slog"

	"github.com/google/uuid"
)

// NotificationStub implements the ports.NotificationPort interface for development and testing.
type NotificationStub struct{}

// NewNotificationStub creates a new instance of NotificationStub.
func NewNotificationStub() *NotificationStub {
	return &NotificationStub{}
}

// SendActivationLink simulates sending an activation email by logging the details.
func (s *NotificationStub) SendActivationLink(ctx context.Context, userID uuid.UUID, email string, activationLink string) error {
	slog.Info("NotificationStub: Sending account activation link",
		"user_id", userID,
		"email", email,
		"activation_link", activationLink,
	)

	// In a real implementation, this would make a gRPC or REST call to the email-notify-service.
	return nil
}

// SendPasswordResetLink simulates sending a password reset email by logging the details.
func (s *NotificationStub) SendPasswordResetLink(ctx context.Context, userID uuid.UUID, email string, resetLink string) error {
	slog.Info("NotificationStub: Sending password reset link",
		"user_id", userID,
		"email", email,
		"reset_link", resetLink,
	)

	// In a real implementation, this would make a gRPC or REST call to the email-notify-service.
	return nil
}
