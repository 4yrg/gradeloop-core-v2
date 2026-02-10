package repositories

import (
	"context"
	"fmt"
	"log"
	"time"

	"email-notify-service/internal/core/ports"

	amqp "github.com/rabbitmq/amqp091-go"
)

type RabbitMQRepository struct {
	conn    *amqp.Connection
	channel *amqp.Channel
}

// Ensure RabbitMQRepository implements the EventPublisher and EventConsumer ports
var _ ports.EventPublisher = (*RabbitMQRepository)(nil)
var _ ports.EventConsumer = (*RabbitMQRepository)(nil)

func NewRabbitMQRepository(url string) (*RabbitMQRepository, error) {
	conn, err := amqp.Dial(url)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to RabbitMQ: %w", err)
	}

	channel, err := conn.Channel()
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to open channel: %w", err)
	}

	return &RabbitMQRepository{
		conn:    conn,
		channel: channel,
	}, nil
}

// Publish implements EventPublisher
func (r *RabbitMQRepository) Publish(ctx context.Context, exchange, routingKey string, message []byte) error {
	// Declare exchange if it doesn't exist
	err := r.channel.ExchangeDeclare(
		exchange, // name
		"topic",  // type
		true,     // durable
		false,    // auto-deleted
		false,    // internal
		false,    // no-wait
		nil,      // arguments
	)
	if err != nil {
		return fmt.Errorf("failed to declare exchange: %w", err)
	}

	// Create a context with timeout for publishing
	publishCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	err = r.channel.PublishWithContext(
		publishCtx,
		exchange,   // exchange
		routingKey, // routing key
		false,      // mandatory
		false,      // immediate
		amqp.Publishing{
			ContentType:  "application/json",
			DeliveryMode: amqp.Persistent,
			Body:         message,
			Timestamp:    time.Now(),
		},
	)

	if err != nil {
		return fmt.Errorf("failed to publish message: %w", err)
	}

	log.Printf("[RabbitMQ] Published message to exchange %s with routing key %s", exchange, routingKey)
	return nil
}

// Consume implements EventConsumer
func (r *RabbitMQRepository) Consume(ctx context.Context, queue string, handler func([]byte) error) error {
	// Declare queue
	q, err := r.channel.QueueDeclare(
		queue, // name
		true,  // durable
		false, // delete when unused
		false, // exclusive
		false, // no-wait
		nil,   // arguments
	)
	if err != nil {
		return fmt.Errorf("failed to declare queue: %w", err)
	}

	// Set QoS to process one message at a time
	err = r.channel.Qos(
		1,     // prefetch count
		0,     // prefetch size
		false, // global
	)
	if err != nil {
		return fmt.Errorf("failed to set QoS: %w", err)
	}

	// Start consuming messages
	msgs, err := r.channel.Consume(
		q.Name, // queue
		"",     // consumer
		false,  // auto-ack (we'll manually ack)
		false,  // exclusive
		false,  // no-local
		false,  // no-wait
		nil,    // args
	)
	if err != nil {
		return fmt.Errorf("failed to register consumer: %w", err)
	}

	log.Printf("[RabbitMQ] Starting to consume messages from queue %s", queue)

	// Process messages
	for {
		select {
		case <-ctx.Done():
			log.Printf("[RabbitMQ] Consumer stopped due to context cancellation")
			return ctx.Err()
		case msg, ok := <-msgs:
			if !ok {
				log.Printf("[RabbitMQ] Message channel closed")
				return fmt.Errorf("message channel closed")
			}

			// Process message
			err := handler(msg.Body)
			if err != nil {
				log.Printf("[RabbitMQ] Failed to process message: %v", err)
				// Reject message and requeue for retry
				msg.Nack(false, true)
			} else {
				log.Printf("[RabbitMQ] Successfully processed message")
				// Acknowledge message
				msg.Ack(false)
			}
		}
	}
}

// SetupEmailQueue sets up the exchange, queue, and bindings for email events
func (r *RabbitMQRepository) SetupEmailQueue(exchange, queue string) error {
	// Declare exchange
	err := r.channel.ExchangeDeclare(
		exchange, // name
		"topic",  // type
		true,     // durable
		false,    // auto-deleted
		false,    // internal
		false,    // no-wait
		nil,      // arguments
	)
	if err != nil {
		return fmt.Errorf("failed to declare exchange: %w", err)
	}

	// Declare queue
	_, err = r.channel.QueueDeclare(
		queue, // name
		true,  // durable
		false, // delete when unused
		false, // exclusive
		false, // no-wait
		nil,   // arguments
	)
	if err != nil {
		return fmt.Errorf("failed to declare queue: %w", err)
	}

	// Bind queue to exchange for user events
	err = r.channel.QueueBind(
		queue,    // queue name
		"user.*", // routing key pattern
		exchange, // exchange
		false,    // no-wait
		nil,      // arguments
	)
	if err != nil {
		return fmt.Errorf("failed to bind queue to exchange for user events: %w", err)
	}

	// Bind queue to exchange for password events
	err = r.channel.QueueBind(
		queue,        // queue name
		"password.*", // routing key pattern
		exchange,     // exchange
		false,        // no-wait
		nil,          // arguments
	)
	if err != nil {
		return fmt.Errorf("failed to bind queue to exchange for password events: %w", err)
	}

	log.Printf("[RabbitMQ] Setup completed for exchange %s and queue %s", exchange, queue)
	return nil
}

func (r *RabbitMQRepository) Close() error {
	if r.channel != nil {
		r.channel.Close()
	}
	if r.conn != nil {
		r.conn.Close()
	}
	return nil
}
