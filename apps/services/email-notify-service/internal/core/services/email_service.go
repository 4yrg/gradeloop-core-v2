package services

import (
	"bytes"
	"context"
	"fmt"
	"html/template"
	"log"
	"path/filepath"

	"email-notify-service/internal/core/domain"
	"email-notify-service/internal/core/ports"
)

type EmailService struct {
	sender ports.EmailSender
}

// Ensure EmailService implements the primary port
var _ ports.EmailService = (*EmailService)(nil)

func NewEmailService(sender ports.EmailSender) *EmailService {
	return &EmailService{
		sender: sender,
	}
}

func (s *EmailService) Send(ctx context.Context, req domain.EmailRequest) error {
	// 1. Render Template (Business Logic)
	body, err := s.render(req.TemplateName, req.TemplateData)
	if err != nil {
		return fmt.Errorf("rendering failed: %w", err)
	}

	// 2. Delegate to Repository (Infrastructure)
	return s.sender.SendEmail(ctx, req.To, req.Subject, body)
}

// ProcessUserCreatedEvent handles user.created events
func (s *EmailService) ProcessUserCreatedEvent(ctx context.Context, event domain.UserCreatedEvent) error {
	log.Printf("[EmailService] Processing user.created event for user %s", event.UserID)

	// Generate activation link (in real scenario, this would be from config or another service)
	activationLink := fmt.Sprintf("https://gradeloop.com/activate?token=%s", event.UserID)

	req := domain.EmailRequest{
		To:           []string{event.Email},
		Subject:      "Activate Your GradeLoop Account",
		TemplateName: "account_activation.html",
		TemplateData: map[string]any{
			"Name":           event.Name,
			"ActivationLink": activationLink,
		},
	}

	return s.Send(ctx, req)
}

// ProcessPasswordResetEvent handles password.reset.requested events
func (s *EmailService) ProcessPasswordResetEvent(ctx context.Context, event domain.PasswordResetEvent) error {
	log.Printf("[EmailService] Processing password.reset.requested event for user %s", event.UserID)

	req := domain.EmailRequest{
		To:           []string{event.Email},
		Subject:      "Reset Your GradeLoop Password",
		TemplateName: "password_reset.html",
		TemplateData: map[string]any{
			"Name":      event.Name,
			"ResetLink": event.ResetLink,
		},
	}

	return s.Send(ctx, req)
}

// Helper to parse templates
func (s *EmailService) render(name string, data map[string]any) (string, error) {
	// Templates assumed to be in ./templates/ relative to working directory
	path := filepath.Join("templates", name)

	tmpl, err := template.ParseFiles(path)
	if err != nil {
		return "", fmt.Errorf("template file not found: %v", err)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("template execution error: %v", err)
	}

	return buf.String(), nil
}
