package queue

import (
	"fmt"
	"sync"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
	"go.uber.org/zap"
)

const (
	// SubmissionExchange is the durable topic exchange all submission messages
	// are routed through.
	SubmissionExchange = "submissions"

	// SubmissionQueue is the durable queue that backs the submission worker pool.
	SubmissionQueue = "submission.process"

	// SubmissionRoutingKey is the routing key used when publishing a new
	// submission job.  Consumers bind with the same key.
	SubmissionRoutingKey = "submission.created"

	// reconnectDelay is the base back-off between reconnection attempts.
	reconnectDelay = 5 * time.Second

	// maxReconnectAttempts is the maximum number of times the manager will try
	// to re-establish a lost connection before giving up.
	maxReconnectAttempts = 10
)

// ─────────────────────────────────────────────────────────────────────────────
// RabbitMQ – connection manager
// ─────────────────────────────────────────────────────────────────────────────

// RabbitMQ manages a single AMQP connection and exposes helpers that open
// channels on demand.  On connection loss it transparently re-dials up to
// maxReconnectAttempts times with a fixed back-off delay before giving up.
//
// All exported methods are safe for concurrent use.
type RabbitMQ struct {
	url    string
	conn   *amqp.Connection
	mu     sync.RWMutex
	logger *zap.Logger
}

// NewRabbitMQ dials the broker at url, declares the exchange and queue, and
// returns a ready-to-use RabbitMQ manager.
func NewRabbitMQ(url string, logger *zap.Logger) (*RabbitMQ, error) {
	r := &RabbitMQ{url: url, logger: logger}

	if err := r.connect(); err != nil {
		return nil, err
	}

	// Topology declaration happens once at startup.
	if err := r.declareTopology(); err != nil {
		return nil, err
	}

	return r, nil
}

// Channel opens and returns a fresh AMQP channel on the current connection.
// If the connection has been lost and the manager has not yet reconnected,
// the caller receives an error.
func (r *RabbitMQ) Channel() (*amqp.Channel, error) {
	r.mu.RLock()
	conn := r.conn
	r.mu.RUnlock()

	if conn == nil || conn.IsClosed() {
		return nil, fmt.Errorf("rabbitmq: connection is not available")
	}

	ch, err := conn.Channel()
	if err != nil {
		return nil, fmt.Errorf("rabbitmq: opening channel: %w", err)
	}

	// Enable publisher confirms so callers can verify messages were accepted
	// by the broker.
	if err := ch.Confirm(false); err != nil {
		ch.Close()
		return nil, fmt.Errorf("rabbitmq: enabling confirms: %w", err)
	}

	return ch, nil
}

// Close shuts down the underlying AMQP connection.
func (r *RabbitMQ) Close() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.conn != nil && !r.conn.IsClosed() {
		return r.conn.Close()
	}

	return nil
}

// WatchReconnect listens for connection-close notifications and transparently
// re-dials the broker.  It is intended to be launched as a goroutine once
// after construction and runs until the application exits.
//
//	go rmq.WatchReconnect()
func (r *RabbitMQ) WatchReconnect() {
	for {
		r.mu.RLock()
		conn := r.conn
		r.mu.RUnlock()

		if conn == nil {
			return
		}

		// Block until the broker closes the connection.
		reason, ok := <-conn.NotifyClose(make(chan *amqp.Error, 1))
		if !ok {
			// Channel was closed intentionally (e.g. r.Close() was called).
			r.logger.Info("rabbitmq: connection closed intentionally; stopping reconnect watcher")
			return
		}

		r.logger.Warn("rabbitmq: connection lost; attempting to reconnect",
			zap.String("reason", reason.Reason),
			zap.Int("code", reason.Code),
		)

		var lastErr error
		for attempt := 1; attempt <= maxReconnectAttempts; attempt++ {
			time.Sleep(reconnectDelay)

			r.logger.Info("rabbitmq: reconnect attempt",
				zap.Int("attempt", attempt),
				zap.Int("max", maxReconnectAttempts),
			)

			if err := r.connect(); err != nil {
				lastErr = err
				r.logger.Warn("rabbitmq: reconnect attempt failed",
					zap.Int("attempt", attempt),
					zap.Error(err),
				)
				continue
			}

			if err := r.declareTopology(); err != nil {
				lastErr = err
				r.logger.Warn("rabbitmq: topology re-declaration failed after reconnect",
					zap.Int("attempt", attempt),
					zap.Error(err),
				)
				continue
			}

			r.logger.Info("rabbitmq: reconnected successfully", zap.Int("attempt", attempt))
			lastErr = nil
			break
		}

		if lastErr != nil {
			r.logger.Error("rabbitmq: all reconnect attempts exhausted; giving up",
				zap.Error(lastErr),
			)
			return
		}
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

// connect dials the broker and stores the connection under the write lock.
func (r *RabbitMQ) connect() error {
	conn, err := amqp.Dial(r.url)
	if err != nil {
		return fmt.Errorf("rabbitmq: dialing %q: %w", r.url, err)
	}

	r.mu.Lock()
	r.conn = conn
	r.mu.Unlock()

	r.logger.Info("rabbitmq: connected", zap.String("url", r.url))
	return nil
}

// declareTopology opens a short-lived channel to declare the exchange, queue,
// and binding.  The channel is closed immediately after — callers that need a
// long-lived channel should call Channel() separately.
func (r *RabbitMQ) declareTopology() error {
	ch, err := r.conn.Channel()
	if err != nil {
		return fmt.Errorf("rabbitmq: opening channel for topology declaration: %w", err)
	}
	defer ch.Close()

	// Durable topic exchange — survives broker restarts.
	if err := ch.ExchangeDeclare(
		SubmissionExchange, // name
		"topic",            // kind
		true,               // durable
		false,              // auto-delete
		false,              // internal
		false,              // no-wait
		nil,                // args
	); err != nil {
		return fmt.Errorf("rabbitmq: declaring exchange %q: %w", SubmissionExchange, err)
	}

	// Durable queue — messages survive broker restarts.
	if _, err := ch.QueueDeclare(
		SubmissionQueue, // name
		true,            // durable
		false,           // auto-delete
		false,           // exclusive
		false,           // no-wait
		amqp.Table{
			// Dead-letter exchange for failed / rejected messages.
			"x-dead-letter-exchange": SubmissionExchange + ".dlx",
			// Max 50 000 messages before the broker starts dropping new ones
			// to protect memory under extreme load.
			"x-max-length": int64(50_000),
		},
	); err != nil {
		return fmt.Errorf("rabbitmq: declaring queue %q: %w", SubmissionQueue, err)
	}

	// Declare a dead-letter exchange (fanout) so rejected messages are not
	// silently discarded.
	if err := ch.ExchangeDeclare(
		SubmissionExchange+".dlx",
		"fanout",
		true,
		false,
		false,
		false,
		nil,
	); err != nil {
		return fmt.Errorf("rabbitmq: declaring DLX: %w", err)
	}

	// Dead-letter queue — operators can inspect or replay failed jobs.
	if _, err := ch.QueueDeclare(
		SubmissionQueue+".dead",
		true,
		false,
		false,
		false,
		nil,
	); err != nil {
		return fmt.Errorf("rabbitmq: declaring dead-letter queue: %w", err)
	}

	if err := ch.QueueBind(
		SubmissionQueue+".dead",
		"",
		SubmissionExchange+".dlx",
		false,
		nil,
	); err != nil {
		return fmt.Errorf("rabbitmq: binding dead-letter queue: %w", err)
	}

	// Bind the main queue to the exchange with the submission routing key.
	if err := ch.QueueBind(
		SubmissionQueue,      // queue name
		SubmissionRoutingKey, // routing key
		SubmissionExchange,   // exchange
		false,
		nil,
	); err != nil {
		return fmt.Errorf("rabbitmq: binding queue %q: %w", SubmissionQueue, err)
	}

	r.logger.Info("rabbitmq: topology declared",
		zap.String("exchange", SubmissionExchange),
		zap.String("queue", SubmissionQueue),
	)

	return nil
}
