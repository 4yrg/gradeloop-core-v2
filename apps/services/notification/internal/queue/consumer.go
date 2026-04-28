package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	notifier "github.com/4yrg/gradeloop-core-v2/packages/go/notifier"
	amqp "github.com/rabbitmq/amqp091-go"
	"go.uber.org/zap"
)

type NotificationProcessor func(ctx context.Context, notification notifier.Notification) error

type NotificationConsumer struct {
	rmq       *RabbitMQ
	processor NotificationProcessor
	logger    *zap.Logger
}

func NewNotificationConsumer(rmq *RabbitMQ, processor NotificationProcessor, logger *zap.Logger) *NotificationConsumer {
	return &NotificationConsumer{
		rmq:       rmq,
		processor: processor,
		logger:    logger,
	}
}

func (c *NotificationConsumer) Start(ctx context.Context) {
	c.logger.Info("notification consumer starting",
		zap.String("queue", NotificationQueue),
	)

	for {
		if err := c.consume(ctx); err != nil {
			if ctx.Err() != nil {
				c.logger.Info("notification consumer stopped (context cancelled)")
				return
			}

			c.logger.Warn("notification consumer channel error; will retry",
				zap.Error(err),
				zap.Duration("retry_after", reconnectDelay),
			)

			select {
			case <-ctx.Done():
				c.logger.Info("notification consumer stopped (context cancelled during backoff)")
				return
			case <-time.After(reconnectDelay):
			}
		} else {
			return
		}
	}
}

func (c *NotificationConsumer) consume(ctx context.Context) error {
	ch, err := c.rmq.ConsumerChannel(4)
	if err != nil {
		return fmt.Errorf("opening consumer channel: %w", err)
	}
	defer ch.Close()

	deliveries, err := ch.Consume(
		NotificationQueue,
		"",
		false,
		false,
		false,
		false,
		nil,
	)
	if err != nil {
		return fmt.Errorf("registering consumer on %q: %w", NotificationQueue, err)
	}

	c.logger.Info("notification consumer ready, waiting for messages",
		zap.String("queue", NotificationQueue),
	)

	chanClose := ch.NotifyClose(make(chan *amqp.Error, 1))

	for {
		select {
		case <-ctx.Done():
			return nil

		case amqpErr, ok := <-chanClose:
			if !ok || amqpErr == nil {
				return fmt.Errorf("amqp channel closed")
			}
			return fmt.Errorf("amqp channel closed by broker: code=%d reason=%s",
				amqpErr.Code, amqpErr.Reason)

		case delivery, ok := <-deliveries:
			if !ok {
				return fmt.Errorf("deliveries channel closed")
			}
			c.handleDelivery(ctx, delivery)
		}
	}
}

func (c *NotificationConsumer) handleDelivery(ctx context.Context, d amqp.Delivery) {
	logger := c.logger.With(zap.String("message_id", d.MessageId))

	var notification notifier.Notification
	if err := json.Unmarshal(d.Body, &notification); err != nil {
		logger.Error("failed to unmarshal notification; sending to dead-letter queue",
			zap.Error(err),
			zap.ByteString("body", d.Body),
		)
		_ = d.Nack(false, false)
		return
	}

	logger = logger.With(
		zap.String("notification_id", notification.ID),
		zap.String("type", notification.Type),
		zap.Int("recipients", len(notification.UserIDs)),
		zap.Bool("redelivered", d.Redelivered),
	)

	logger.Info("processing notification")

	if err := c.processor(ctx, notification); err != nil {
		if d.Redelivered {
			logger.Error("notification processing failed on retry; sending to dead-letter queue",
				zap.Error(err),
			)
			_ = d.Nack(false, false)
		} else {
			logger.Warn("notification processing failed; requeueing for retry",
				zap.Error(err),
			)
			_ = d.Nack(false, true)
		}
		return
	}

	if err := d.Ack(false); err != nil {
		logger.Error("failed to ack notification", zap.Error(err))
		return
	}

	logger.Info("notification processed and acknowledged")
}