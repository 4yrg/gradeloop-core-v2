package repositories

import (
	"context"
	"fmt"
	"log"
	"time"

	"email-notify-service/internal/core/domain"
	"email-notify-service/internal/core/ports"

	"gopkg.in/gomail.v2"
)

type SmtpRepository struct {
	config domain.SMTPConfig
}

// Ensure SmtpRepository implements the EmailSender port
var _ ports.EmailSender = (*SmtpRepository)(nil)

func NewSmtpRepository(cfg domain.SMTPConfig) *SmtpRepository {
	return &SmtpRepository{
		config: cfg,
	}
}

// SendEmail implements ports.EmailSender with Retry Logic
func (r *SmtpRepository) SendEmail(ctx context.Context, to []string, subject string, body string) error {
	m := gomail.NewMessage()
	m.SetHeader("From", r.config.Username)
	m.SetHeader("To", to...)
	m.SetHeader("Subject", subject)
	m.SetBody("text/html", body)

	// Retry Policy: 3 attempts with exponential backoff
	backoffs := []time.Duration{30 * time.Second, 60 * time.Second, 120 * time.Second}
	maxRetries := len(backoffs)

	for attempt := 0; attempt <= maxRetries; attempt++ {
		// Create a new dialer for each attempt to ensure fresh connection
		d := gomail.NewDialer(r.config.Host, r.config.Port, r.config.Username, r.config.Password)

		// Note: gomail handles STARTTLS automatically.
		// If explicit SSL is required (usually port 465), you might need: d.SSL = true

		if err := d.DialAndSend(m); err != nil {
			log.Printf("[SMTP] Attempt %d/%d failed: %v", attempt+1, maxRetries+1, err)

			if attempt == maxRetries {
				return fmt.Errorf("SMTP delivery failed after %d attempts: %w", maxRetries+1, err)
			}

			// Wait before retrying
			log.Printf("[SMTP] Retrying in %v...", backoffs[attempt])
			select {
			case <-ctx.Done():
				return ctx.Err() // Stop if request is cancelled
			case <-time.After(backoffs[attempt]):
				continue
			}
		}

		// Success
		log.Printf("[SMTP] Email sent to %v", to)
		return nil
	}
	return nil
}
