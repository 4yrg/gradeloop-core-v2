package domain

import "time"

// SMTPConfig holds the infrastructure configuration.
type SMTPConfig struct {
	Host     string
	Port     int
	Username string
	Password string
	UseTLS   bool
}

// EmailRequest represents the data required to trigger an email.
type EmailRequest struct {
	To           []string       `json:"to"`
	Subject      string         `json:"subject"`
	TemplateName string         `json:"template_name"` // e.g., "account_activation.html"
	TemplateData map[string]any `json:"template_data"` // Dynamic data for the template
}

// UserCreatedEvent represents the event published when a user is created
type UserCreatedEvent struct {
	EventID   string    `json:"event_id"`
	EventType string    `json:"event_type"` // "user.created"
	UserID    string    `json:"user_id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	Timestamp time.Time `json:"timestamp"`
}

// PasswordResetEvent represents the event published when a password reset is requested
type PasswordResetEvent struct {
	EventID   string    `json:"event_id"`
	EventType string    `json:"event_type"` // "password.reset.requested"
	UserID    string    `json:"user_id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	ResetLink string    `json:"reset_link"`
	Timestamp time.Time `json:"timestamp"`
}

// EmailStatus represents the delivery status of an email
type EmailStatus struct {
	ID          string    `json:"id"`
	To          []string  `json:"to"`
	Subject     string    `json:"subject"`
	Status      string    `json:"status"` // "sent", "failed", "retrying"
	Attempts    int       `json:"attempts"`
	LastAttempt time.Time `json:"last_attempt"`
	Error       string    `json:"error,omitempty"`
}

// Config represents the application configuration
type Config struct {
	Server struct {
		Host string `env:"SERVER_HOST" envDefault:"localhost"`
		Port int    `env:"SERVER_PORT" envDefault:"8080"`
	}
	RabbitMQ struct {
		URL      string `env:"RABBITMQ_URL" envDefault:"amqp://guest:guest@localhost:5672/"`
		Exchange string `env:"RABBITMQ_EXCHANGE" envDefault:"gradeloop.events"`
		Queue    string `env:"RABBITMQ_QUEUE" envDefault:"email.notifications"`
	}
	Vault struct {
		Address   string `env:"VAULT_ADDR" envDefault:"http://localhost:8200"`
		Token     string `env:"VAULT_TOKEN" envDefault:"dev-root-token"`
		Namespace string `env:"VAULT_NAMESPACE" envDefault:""`
		MountPath string `env:"VAULT_MOUNT_PATH" envDefault:"secret"`
	}
	SMTP struct {
		SecretPath string `env:"SMTP_SECRET_PATH" envDefault:"secret/data/smtp"`
	}
}
