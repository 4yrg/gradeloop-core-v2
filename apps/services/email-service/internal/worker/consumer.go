package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"

	"github.com/google/uuid"
	"github.com/gradeloop/email-service/internal/domain"
	infra "github.com/gradeloop/email-service/internal/infrastructure"
	"github.com/gradeloop/email-service/internal/infrastructure/rabbitmq"
	amqp "github.com/rabbitmq/amqp091-go"
)

type Consumer struct {
	consumer *rabbitmq.Consumer
	repo     domain.EmailRepository
	mailer   *infra.Mailer
	producer *rabbitmq.Producer // For retry/dead-letter
}

func NewConsumer(consumer *rabbitmq.Consumer, repo domain.EmailRepository, mailer *infra.Mailer, producer *rabbitmq.Producer) *Consumer {
	return &Consumer{
		consumer: consumer,
		repo:     repo,
		mailer:   mailer,
		producer: producer,
	}
}

func (c *Consumer) Start(ctx context.Context) {
	log.Println("Starting RabbitMQ Consumer...")
	msgs, err := c.consumer.Consume("email.send") // Queue name
	if err != nil {
		log.Fatalf("Failed to start consumer: %v", err)
	}

	forever := make(chan bool)

	go func() {
		for d := range msgs {
			log.Printf("Received a message: %s", d.Body)
			if err := c.processMessage(ctx, d); err != nil {
				log.Printf("Error processing message: %v", err)
				d.Nack(false, true) // Requeue
			} else {
				d.Ack(false)
			}
		}
	}()

	log.Printf(" [*] Waiting for messages. To exit press CTRL+C")
	<-forever
}

func (c *Consumer) processMessage(ctx context.Context, m amqp.Delivery) error {
	var event struct {
		MessageID  uuid.UUID              `json:"message_id"`
		TemplateID *uuid.UUID             `json:"template_id"`
		Recipients []string               `json:"recipients"`
		Subject    string                 `json:"subject"`
		BodyHTML   string                 `json:"body_html,omitempty"`
		BodyText   string                 `json:"body_text,omitempty"`
		Variables  map[string]interface{} `json:"variables"`
	}

	if err := json.Unmarshal(m.Body, &event); err != nil {
		return err
	}

	// 1. Fetch Message Status (idempotency check?)
	_, err := c.repo.GetMessage(ctx, event.MessageID)
	if err != nil {
		return err
	}

	// 2. Resolve Body
	var bodyHTML, bodyText string
	if event.TemplateID != nil {
		tmpl, err := c.repo.GetTemplate(ctx, *event.TemplateID)
		if err != nil {
			log.Printf("Failed to get template: %v", err)
			// Proceed with empty body or return error?
			// Check if we can proceed. If template missing, maybe fail.
			return err
		}
		// Simple interpolation (replace {{key}} with value)
		bodyHTML = tmpl.BodyHTML
		bodyText = tmpl.BodyText
		for k, v := range event.Variables {
			val := fmt.Sprintf("%v", v)
			bodyHTML = strings.ReplaceAll(bodyHTML, "{{"+k+"}}", val)
			bodyText = strings.ReplaceAll(bodyText, "{{"+k+"}}", val)
		}
	} else {
		// Use provided body content
		bodyHTML = event.BodyHTML
		bodyText = event.BodyText
		if bodyHTML == "" && bodyText == "" {
			bodyHTML = "<h1>No Content</h1>"
			bodyText = "No Content"
		}
	}

	// 3. Send Email
	if err := c.mailer.Send(event.Recipients, event.Subject, bodyHTML, bodyText); err != nil {
		log.Printf("Failed to send email: %v", err)
		c.repo.UpdateMessageStatus(ctx, event.MessageID, domain.StatusFailed)
		return err // Force retry
	}

	// 4. Update Status
	return c.repo.UpdateMessageStatus(ctx, event.MessageID, domain.StatusSent)
}
