package worker

import (
	"context"
	"encoding/json"
	"log"

	"github.com/google/uuid"
	"github.com/gradeloop/email-service/internal/config"
	"github.com/gradeloop/email-service/internal/domain"
	infra "github.com/gradeloop/email-service/internal/infrastructure"
	infraKafka "github.com/gradeloop/email-service/internal/infrastructure/kafka"
	"github.com/segmentio/kafka-go"
)

type Consumer struct {
	reader  *kafka.Reader
	service domain.EmailService // To update status ?? Or just repo?
	// Better to use Repo directly or a specific invalidation logic, but service is fine.
	// Actually, clean architecture says Worker uses Service or UseCases.
	// But here Worker sends email using Mailer, then updates DB.
	mailer   *infra.Mailer
	repo     domain.EmailRepository
	producer *infraKafka.Producer // For retry/dead-letter
}

func NewConsumer(cfg *config.Config, repo domain.EmailRepository, mailer *infra.Mailer, producer *infraKafka.Producer) *Consumer {
	r := kafka.NewReader(kafka.ReaderConfig{
		Brokers:  cfg.Kafka.Brokers,
		GroupID:  cfg.Kafka.GroupID,
		Topic:    "email.send",
		MinBytes: 10e3, // 10KB
		MaxBytes: 10e6, // 10MB
		// Dialing config needed for SASL/SSL similarly to producer
	})

	return &Consumer{
		reader:   r,
		repo:     repo,
		mailer:   mailer,
		producer: producer,
	}
}

func (c *Consumer) Start(ctx context.Context) {
	log.Println("Starting Kafka Consumer...")
	for {
		m, err := c.reader.FetchMessage(ctx)
		if err != nil {
			log.Printf("Failed to fetch message: %v", err)
			continue
		}

		log.Printf("Processing message at topic/partition/offset %v/%v/%v: %s = %s\n", m.Topic, m.Partition, m.Offset, string(m.Key), string(m.Value))

		if err := c.processMessage(ctx, m); err != nil {
			log.Printf("Error processing message: %v", err)
			// Retry logic would go here (publish to retry topic)
		} else {
			if err := c.reader.CommitMessages(ctx, m); err != nil {
				log.Printf("Failed to commit message: %v", err)
			}
		}
	}
}

func (c *Consumer) processMessage(ctx context.Context, m kafka.Message) error {
	var event struct {
		MessageID  uuid.UUID `json:"message_id"`
		Recipients []string  `json:"recipients"`
		Subject    string    `json:"subject"`
		// ... other fields
	}

	if err := json.Unmarshal(m.Value, &event); err != nil {
		return err
	}

	// 1. Send Email (Mocked or Real)
	// We need to fetch body if it was template-based, or it's in payload.
	// For now assuming payload has enough info or we fetch from DB.
	// Let's fetch the message from DB to get status ensuring duplicate processing check?
	_, err := c.repo.GetMessage(ctx, event.MessageID)
	if err != nil {
		return err
	}

	// Send
	// c.mailer.Send(event.Recipients, event.Subject, "<h1>Hello</h1>", "Hello")

	// Update Status
	c.repo.UpdateMessageStatus(ctx, event.MessageID, domain.StatusSent)

	return nil
}
