package ports

import (
	"context"
	"email-notify-service/internal/core/domain"
)

// EmailService (Primary Port)
// This is the interface our HTTP/Event handlers will talk to.
type EmailService interface {
	Send(ctx context.Context, req domain.EmailRequest) error
	ProcessUserCreatedEvent(ctx context.Context, event domain.UserCreatedEvent) error
	ProcessPasswordResetEvent(ctx context.Context, event domain.PasswordResetEvent) error
}

// EmailSender (Secondary Port)
// This is the interface our Repository (SMTP) will implement.
type EmailSender interface {
	SendEmail(ctx context.Context, to []string, subject string, body string) error
}

// EventPublisher (Secondary Port)
// This is the interface for publishing events (RabbitMQ)
type EventPublisher interface {
	Publish(ctx context.Context, exchange, routingKey string, message []byte) error
	Close() error
}

// EventConsumer (Secondary Port)
// This is the interface for consuming events (RabbitMQ)
type EventConsumer interface {
	Consume(ctx context.Context, queue string, handler func([]byte) error) error
	Close() error
}

// SecretsRepository (Secondary Port)
// This is the interface for retrieving secrets from Vault
type SecretsRepository interface {
	GetSMTPConfig(ctx context.Context) (*domain.SMTPConfig, error)
	Close() error
}
