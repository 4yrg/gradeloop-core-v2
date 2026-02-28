package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	amqp "github.com/rabbitmq/amqp091-go"
	"go.uber.org/zap"
)

// ACAFSJob is the message payload for ACAFS rubric scoring.
type ACAFSJob struct {
	SubmissionID uuid.UUID `json:"submission_id"`
	AssignmentID uuid.UUID `json:"assignment_id"`
	UserID       string    `json:"user_id"`
	StoragePath  string    `json:"storage_path"`
	Language     string    `json:"language"`
	LanguageID   int       `json:"language_id"`
	Code         string    `json:"code"`
	Username     string    `json:"username"`
	IPAddress    string    `json:"ip_address"`
	UserAgent    string    `json:"user_agent"`
	EnqueuedAt   time.Time `json:"enqueued_at"`
}

// ACAFSExchange is the RabbitMQ exchange for ACAFS messages.
const ACAFSExchange = "submissions"

// ACAFSRoutingKey is the routing key for ACAFS messages.
const ACAFSRoutingKey = "submission.created"

// ACAFSQueue is the queue name for ACAFS evaluation.
const ACAFSQueue = "acafs.evaluation"

// ACAFSProducer publishes ACAFSJob messages to the ACAFS queue.
type ACAFSProducer struct {
	rmq    *RabbitMQ
	logger *zap.Logger
}

// NewACAFSProducer creates an ACAFSProducer.
func NewACAFSProducer(rmq *RabbitMQ, logger *zap.Logger) *ACAFSProducer {
	return &ACAFSProducer{
		rmq:    rmq,
		logger: logger,
	}
}

// Publish serializes job as JSON and delivers it to the ACAFS queue.
func (p *ACAFSProducer) Publish(ctx context.Context, job ACAFSJob) error {
	job.EnqueuedAt = time.Now().UTC()

	body, err := json.Marshal(job)
	if err != nil {
		return fmt.Errorf("acafs publisher: marshalling job: %w", err)
	}

	ch, err := p.rmq.Channel()
	if err != nil {
		return fmt.Errorf("acafs publisher: acquiring channel: %w", err)
	}
	defer ch.Close()

	confirms := ch.NotifyPublish(make(chan amqp.Confirmation, 1))

	err = ch.PublishWithContext(
		ctx,
		ACAFSExchange,   // exchange
		ACAFSRoutingKey, // routing key
		true,            // mandatory
		false,           // immediate
		amqp.Publishing{
			ContentType:  "application/json",
			DeliveryMode: amqp.Persistent,
			MessageId:    job.SubmissionID.String(),
			Timestamp:    job.EnqueuedAt,
			Body:         body,
		},
	)
	if err != nil {
		return fmt.Errorf("acafs publisher: publishing message: %w", err)
	}

	select {
	case confirm, ok := <-confirms:
		if !ok {
			return fmt.Errorf("acafs publisher: confirms channel closed")
		}
		if !confirm.Ack {
			return fmt.Errorf("acafs publisher: broker nacked message")
		}
		p.logger.Info("acafs job published",
			zap.String("submission_id", job.SubmissionID.String()),
			zap.Uint64("delivery_tag", confirm.DeliveryTag),
		)
		return nil
	case <-ctx.Done():
		return fmt.Errorf("acafs publisher: context cancelled: %w", ctx.Err())
	}
}
