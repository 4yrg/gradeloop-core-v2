package queue

import (
	"fmt"
	"sync"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
	"go.uber.org/zap"
)

const (
	NotificationExchange   = "notifications"
	NotificationQueue      = "notification.process"
	NotificationRoutingKey = "notification.created"

	dlxName           = "notifications.dlx"
	deadQueueName     = "notification.process.dead"
	reconnectDelay    = 5 * time.Second
	maxReconnectAttempts = 10
)

type RabbitMQ struct {
	url    string
	conn   *amqp.Connection
	mu     sync.RWMutex
	logger *zap.Logger
}

func NewRabbitMQ(url string, logger *zap.Logger) (*RabbitMQ, error) {
	r := &RabbitMQ{url: url, logger: logger}

	if err := r.connect(); err != nil {
		return nil, err
	}

	if err := r.declareTopology(); err != nil {
		return nil, err
	}

	return r, nil
}

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

	return ch, nil
}

func (r *RabbitMQ) ConsumerChannel(concurrency int) (*amqp.Channel, error) {
	r.mu.RLock()
	conn := r.conn
	r.mu.RUnlock()

	if conn == nil || conn.IsClosed() {
		return nil, fmt.Errorf("rabbitmq: connection is not available")
	}

	ch, err := conn.Channel()
	if err != nil {
		return nil, fmt.Errorf("rabbitmq: opening consumer channel: %w", err)
	}

	if err := ch.Qos(concurrency, 0, false); err != nil {
		ch.Close()
		return nil, fmt.Errorf("rabbitmq: setting QoS prefetch=%d: %w", concurrency, err)
	}

	return ch, nil
}

func (r *RabbitMQ) Close() error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.conn != nil && !r.conn.IsClosed() {
		return r.conn.Close()
	}
	return nil
}

func (r *RabbitMQ) WatchReconnect() {
	for {
		r.mu.RLock()
		conn := r.conn
		r.mu.RUnlock()

		if conn == nil {
			return
		}

		reason, ok := <-conn.NotifyClose(make(chan *amqp.Error, 1))
		if !ok {
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
			r.logger.Error("rabbitmq: all reconnect attempts exhausted; giving up", zap.Error(lastErr))
			return
		}
	}
}

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

func (r *RabbitMQ) declareTopology() error {
	r.mu.RLock()
	conn := r.conn
	r.mu.RUnlock()

	ch, err := conn.Channel()
	if err != nil {
		return fmt.Errorf("rabbitmq: opening channel for topology declaration: %w", err)
	}
	defer ch.Close()

	if err := ch.ExchangeDeclare(NotificationExchange, "topic", true, false, false, false, nil); err != nil {
		return fmt.Errorf("rabbitmq: declaring exchange %q: %w", NotificationExchange, err)
	}

	if _, err := ch.QueueDeclare(NotificationQueue, true, false, false, false, amqp.Table{
		"x-dead-letter-exchange": dlxName,
		"x-max-length":           int64(100000),
	}); err != nil {
		return fmt.Errorf("rabbitmq: declaring queue %q: %w", NotificationQueue, err)
	}

	if err := ch.ExchangeDeclare(dlxName, "fanout", true, false, false, false, nil); err != nil {
		return fmt.Errorf("rabbitmq: declaring DLX %q: %w", dlxName, err)
	}

	if _, err := ch.QueueDeclare(deadQueueName, true, false, false, false, nil); err != nil {
		return fmt.Errorf("rabbitmq: declaring dead-letter queue %q: %w", deadQueueName, err)
	}

	if err := ch.QueueBind(deadQueueName, "", dlxName, false, nil); err != nil {
		return fmt.Errorf("rabbitmq: binding dead-letter queue: %w", err)
	}

	if err := ch.QueueBind(NotificationQueue, NotificationRoutingKey, NotificationExchange, false, nil); err != nil {
		return fmt.Errorf("rabbitmq: binding queue %q: %w", NotificationQueue, err)
	}

	r.logger.Info("rabbitmq: topology declared",
		zap.String("exchange", NotificationExchange),
		zap.String("queue", NotificationQueue),
	)
	return nil
}