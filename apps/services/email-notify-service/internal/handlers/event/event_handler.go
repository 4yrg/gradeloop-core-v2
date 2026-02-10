package event

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"email-notify-service/internal/core/domain"
	"email-notify-service/internal/core/ports"
)

type EventHandler struct {
	emailService ports.EmailService
}

func NewEventHandler(emailService ports.EmailService) *EventHandler {
	return &EventHandler{
		emailService: emailService,
	}
}

// HandleMessage processes incoming events from RabbitMQ
func (h *EventHandler) HandleMessage(ctx context.Context, messageBody []byte) error {
	log.Printf("[EventHandler] Received message: %s", string(messageBody))

	// Parse the base event to determine the type
	var baseEvent struct {
		EventType string `json:"event_type"`
	}

	if err := json.Unmarshal(messageBody, &baseEvent); err != nil {
		return fmt.Errorf("failed to parse event type: %w", err)
	}

	// Route to specific handlers based on event type
	switch baseEvent.EventType {
	case "user.created":
		return h.handleUserCreatedEvent(ctx, messageBody)
	case "password.reset.requested":
		return h.handlePasswordResetEvent(ctx, messageBody)
	default:
		log.Printf("[EventHandler] Unknown event type: %s", baseEvent.EventType)
		// Return nil to acknowledge the message and prevent requeuing
		return nil
	}
}

// handleUserCreatedEvent processes user creation events
func (h *EventHandler) handleUserCreatedEvent(ctx context.Context, messageBody []byte) error {
	var event domain.UserCreatedEvent

	if err := json.Unmarshal(messageBody, &event); err != nil {
		return fmt.Errorf("failed to parse user.created event: %w", err)
	}

	// Validate required fields
	if event.Email == "" {
		return fmt.Errorf("user.created event missing email field")
	}

	if event.Name == "" {
		return fmt.Errorf("user.created event missing name field")
	}

	log.Printf("[EventHandler] Processing user.created event for %s (%s)", event.Name, event.Email)

	// Process the event using the email service
	if err := h.emailService.ProcessUserCreatedEvent(ctx, event); err != nil {
		return fmt.Errorf("failed to process user.created event: %w", err)
	}

	log.Printf("[EventHandler] Successfully processed user.created event for %s", event.Email)
	return nil
}

// handlePasswordResetEvent processes password reset events
func (h *EventHandler) handlePasswordResetEvent(ctx context.Context, messageBody []byte) error {
	var event domain.PasswordResetEvent

	if err := json.Unmarshal(messageBody, &event); err != nil {
		return fmt.Errorf("failed to parse password.reset.requested event: %w", err)
	}

	// Validate required fields
	if event.Email == "" {
		return fmt.Errorf("password.reset.requested event missing email field")
	}

	if event.Name == "" {
		return fmt.Errorf("password.reset.requested event missing name field")
	}

	if event.ResetLink == "" {
		return fmt.Errorf("password.reset.requested event missing reset_link field")
	}

	log.Printf("[EventHandler] Processing password.reset.requested event for %s (%s)", event.Name, event.Email)

	// Process the event using the email service
	if err := h.emailService.ProcessPasswordResetEvent(ctx, event); err != nil {
		return fmt.Errorf("failed to process password.reset.requested event: %w", err)
	}

	log.Printf("[EventHandler] Successfully processed password.reset.requested event for %s", event.Email)
	return nil
}

// CreateMessageHandler returns a function that can be used with the RabbitMQ consumer
func (h *EventHandler) CreateMessageHandler(ctx context.Context) func([]byte) error {
	return func(messageBody []byte) error {
		return h.HandleMessage(ctx, messageBody)
	}
}
