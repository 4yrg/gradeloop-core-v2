package notifier

import (
	"context"
	"fmt"
	"sync"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
	"go.uber.org/zap"
)

const (
	reconnectDelay      = 5 * time.Second
	maxReconnectAttempts = 10

	queueName    = "notification.process"
	dlxName      = "notifications.dlx"
	deadQueueName = "notification.process.dead"
)

type Publisher struct {
	url    string
	conn   *amqp.Connection
	mu     sync.RWMutex
	logger *zap.Logger
}

func NewPublisher(url string, logger *zap.Logger) (*Publisher, error) {
	p := &Publisher{url: url, logger: logger}
	if err := p.connect(); err != nil {
		return nil, err
	}
	if err := p.declareTopology(); err != nil {
		return nil, err
	}
	return p, nil
}

func (p *Publisher) Publish(ctx context.Context, notification Notification) error {
	body, err := notification.Marshal()
	if err != nil {
		return fmt.Errorf("notifier: marshalling notification: %w", err)
	}

	p.mu.RLock()
	conn := p.conn
	p.mu.RUnlock()

	if conn == nil || conn.IsClosed() {
		return fmt.Errorf("notifier: connection is not available")
	}

	ch, err := conn.Channel()
	if err != nil {
		return fmt.Errorf("notifier: opening channel: %w", err)
	}
	defer ch.Close()

	if err := ch.Confirm(false); err != nil {
		return fmt.Errorf("notifier: enabling confirms: %w", err)
	}

	confirms := ch.NotifyPublish(make(chan amqp.Confirmation, 1))

	err = ch.PublishWithContext(
		ctx,
		NotificationExchange,
		NotificationRoutingKey,
		true,
		false,
		amqp.Publishing{
			ContentType:  "application/json",
			DeliveryMode: amqp.Persistent,
			MessageId:    notification.ID,
			Timestamp:     notification.Timestamp,
			Body:         body,
		},
	)
	if err != nil {
		return fmt.Errorf("notifier: publishing notification: %w", err)
	}

	select {
	case confirm, ok := <-confirms:
		if !ok {
			return fmt.Errorf("notifier: confirms channel closed before ack for notification %s", notification.ID)
		}
		if !confirm.Ack {
			return fmt.Errorf("notifier: broker nacked notification %s", notification.ID)
		}
		p.logger.Info("notification published",
			zap.String("id", notification.ID),
			zap.String("type", notification.Type),
			zap.Int("recipients", len(notification.UserIDs)),
		)
		return nil
	case <-ctx.Done():
		return fmt.Errorf("notifier: context cancelled while waiting for broker confirm: %w", ctx.Err())
	}
}

func (p *Publisher) Close() error {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.conn != nil && !p.conn.IsClosed() {
		return p.conn.Close()
	}
	return nil
}

func (p *Publisher) WatchReconnect() {
	for {
		p.mu.RLock()
		conn := p.conn
		p.mu.RUnlock()

		if conn == nil {
			return
		}

		reason, ok := <-conn.NotifyClose(make(chan *amqp.Error, 1))
		if !ok {
			p.logger.Info("notifier: connection closed intentionally; stopping reconnect watcher")
			return
		}

		p.logger.Warn("notifier: connection lost; attempting to reconnect",
			zap.String("reason", reason.Reason),
			zap.Int("code", reason.Code),
		)

		var lastErr error
		for attempt := 1; attempt <= maxReconnectAttempts; attempt++ {
			time.Sleep(reconnectDelay)

			p.logger.Info("notifier: reconnect attempt",
				zap.Int("attempt", attempt),
				zap.Int("max", maxReconnectAttempts),
			)

			if err := p.connect(); err != nil {
				lastErr = err
				p.logger.Warn("notifier: reconnect attempt failed",
					zap.Int("attempt", attempt),
					zap.Error(err),
				)
				continue
			}

			if err := p.declareTopology(); err != nil {
				lastErr = err
				p.logger.Warn("notifier: topology re-declaration failed after reconnect",
					zap.Int("attempt", attempt),
					zap.Error(err),
				)
				continue
			}

			p.logger.Info("notifier: reconnected successfully", zap.Int("attempt", attempt))
			lastErr = nil
			break
		}

		if lastErr != nil {
			p.logger.Error("notifier: all reconnect attempts exhausted; giving up", zap.Error(lastErr))
			return
		}
	}
}

func (p *Publisher) connect() error {
	conn, err := amqp.Dial(p.url)
	if err != nil {
		return fmt.Errorf("notifier: dialing %q: %w", p.url, err)
	}
	p.mu.Lock()
	p.conn = conn
	p.mu.Unlock()
	p.logger.Info("notifier: connected", zap.String("url", p.url))
	return nil
}

func (p *Publisher) declareTopology() error {
	p.mu.RLock()
	conn := p.conn
	p.mu.RUnlock()

	ch, err := conn.Channel()
	if err != nil {
		return fmt.Errorf("notifier: opening channel for topology declaration: %w", err)
	}
	defer ch.Close()

	if err := ch.ExchangeDeclare(NotificationExchange, "topic", true, false, false, false, nil); err != nil {
		return fmt.Errorf("notifier: declaring exchange %q: %w", NotificationExchange, err)
	}

	if _, err := ch.QueueDeclare(queueName, true, false, false, false, amqp.Table{
		"x-dead-letter-exchange": dlxName,
		"x-max-length":           int64(100000),
	}); err != nil {
		return fmt.Errorf("notifier: declaring queue %q: %w", queueName, err)
	}

	if err := ch.ExchangeDeclare(dlxName, "fanout", true, false, false, false, nil); err != nil {
		return fmt.Errorf("notifier: declaring DLX %q: %w", dlxName, err)
	}

	if _, err := ch.QueueDeclare(deadQueueName, true, false, false, false, nil); err != nil {
		return fmt.Errorf("notifier: declaring dead-letter queue %q: %w", deadQueueName, err)
	}

	if err := ch.QueueBind(deadQueueName, "", dlxName, false, nil); err != nil {
		return fmt.Errorf("notifier: binding dead-letter queue: %w", err)
	}

	if err := ch.QueueBind(queueName, NotificationRoutingKey, NotificationExchange, false, nil); err != nil {
		return fmt.Errorf("notifier: binding queue %q: %w", queueName, err)
	}

	p.logger.Info("notifier: topology declared",
		zap.String("exchange", NotificationExchange),
		zap.String("queue", queueName),
	)
	return nil
}