package ports

import (
	"context"

	"github.com/google/uuid"
)

// NotificationPort defines the interface for sending notifications to users.
// This is typically implemented by a stub or an integration with an external notification service.
type NotificationPort interface {
	SendActivationLink(ctx context.Context, userID uuid.UUID, email string, activationLink string) error
}
