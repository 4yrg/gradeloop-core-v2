package kafka

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"log"
	"time"

	"github.com/gradeloop/email-service/internal/config"
	"github.com/segmentio/kafka-go"
	"github.com/segmentio/kafka-go/sasl/scram"
)

type Producer struct {
	writer *kafka.Writer
}

func NewProducer(cfg *config.Config) *Producer {
	mechanism, err := scram.Mechanism(scram.SHA256, cfg.Kafka.Username, cfg.Kafka.Password)
	if err != nil {
		log.Fatalf("Failed to create SASL mechanism: %v", err)
	}

	dialer := &kafka.Dialer{
		Timeout:       10 * time.Second,
		DualStack:     true,
		SASLMechanism: mechanism,
		TLS:           &tls.Config{},
	}

	// If config has no username, assume local development without SASL
	if cfg.Kafka.Username == "" {
		dialer = nil
		log.Println("Kafka Username not provided, disabling SASL/TLS")
	}

	w := kafka.NewWriter(kafka.WriterConfig{
		Brokers:  cfg.Kafka.Brokers,
		Dialer:   dialer,
		Balancer: &kafka.LeastBytes{},
		// If dialer is nil (local), it defaults to standard TCP
	})

	return &Producer{writer: w}
}

func (p *Producer) Publish(ctx context.Context, topic string, key string, message interface{}) error {
	payload, err := json.Marshal(message)
	if err != nil {
		return err
	}

	// Retry logic is handled by kafka-go writer partially, but we can add valid context
	return p.writer.WriteMessages(ctx, kafka.Message{
		Topic: topic,
		Key:   []byte(key),
		Value: payload,
		Time:  time.Now(),
	})
}

func (p *Producer) Close() error {
	return p.writer.Close()
}
