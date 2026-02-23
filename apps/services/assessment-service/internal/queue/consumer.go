package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
	"go.uber.org/zap"
)

// ─────────────────────────────────────────────────────────────────────────────
// Worker callback contract
// ─────────────────────────────────────────────────────────────────────────────

// JobProcessor is the function signature the consumer calls for every
// SubmissionJob it dequeues.  Implementations must:
//
//   - Return nil on success — the message is ACKed and removed from the queue.
//   - Return a non-nil error on transient failure — the message is NACKed and
//     re-queued once.  If it fails again it is forwarded to the dead-letter
//     queue.
type JobProcessor func(ctx context.Context, job SubmissionJob) error

// ─────────────────────────────────────────────────────────────────────────────
// SubmissionConsumer
// ─────────────────────────────────────────────────────────────────────────────

// SubmissionConsumer reads SubmissionJob messages from the submission queue
// and dispatches them to a pool of worker goroutines via JobProcessor.
//
// Consumer behaviour:
//   - Prefetch (QoS) is set to concurrency so that at most `concurrency`
//     unacknowledged messages are in-flight at any time.
//   - Each message is processed in its own goroutine drawn from the pool.
//   - On success the message is ACKed.
//   - On failure the message is NACKed with requeue=true on the first attempt;
//     if the re-delivered message also fails it is NACKed with requeue=false so
//     the dead-letter exchange can capture it.
//   - When the AMQP channel is closed unexpectedly the consumer automatically
//     re-subscribes using the RabbitMQ connection manager.
type SubmissionConsumer struct {
	rmq         *RabbitMQ
	processor   JobProcessor
	concurrency int
	logger      *zap.Logger
}

// NewSubmissionConsumer creates a SubmissionConsumer.
//
// concurrency controls both the channel QoS prefetch count and the number of
// parallel goroutines that may process jobs simultaneously.  A value between
// 4 and 16 is reasonable for most deployments; tune based on MinIO and DB
// throughput.
func NewSubmissionConsumer(
	rmq *RabbitMQ,
	processor JobProcessor,
	concurrency int,
	logger *zap.Logger,
) *SubmissionConsumer {
	if concurrency < 1 {
		concurrency = 1
	}

	return &SubmissionConsumer{
		rmq:         rmq,
		processor:   processor,
		concurrency: concurrency,
		logger:      logger,
	}
}

// Start begins consuming messages from the submission queue.  It blocks until
// ctx is cancelled, at which point it drains any in-flight deliveries and
// returns.
//
// Start is intended to be run as a long-lived goroutine:
//
//	go consumer.Start(ctx)
func (c *SubmissionConsumer) Start(ctx context.Context) {
	c.logger.Info("submission consumer starting",
		zap.Int("concurrency", c.concurrency),
		zap.String("queue", SubmissionQueue),
	)

	for {
		// Inner consume loop: runs until the channel dies or ctx is cancelled.
		if err := c.consume(ctx); err != nil {
			if ctx.Err() != nil {
				// Parent context cancelled — clean shutdown.
				c.logger.Info("submission consumer stopped (context cancelled)")
				return
			}

			c.logger.Warn("submission consumer channel error; will retry",
				zap.Error(err),
				zap.Duration("retry_after", reconnectDelay),
			)

			select {
			case <-ctx.Done():
				c.logger.Info("submission consumer stopped (context cancelled during backoff)")
				return
			case <-time.After(reconnectDelay):
				// retry
			}
		} else {
			// consume returned nil — context was cancelled.
			return
		}
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal consume loop
// ─────────────────────────────────────────────────────────────────────────────

// consume opens a channel, sets QoS, and registers a consumer.  It dispatches
// each delivery to a worker goroutine (bounded by a semaphore of size
// c.concurrency) and returns when either ctx is cancelled or the AMQP channel
// is closed by the broker.
func (c *SubmissionConsumer) consume(ctx context.Context) error {
	ch, err := c.openConsumerChannel()
	if err != nil {
		return fmt.Errorf("opening consumer channel: %w", err)
	}
	defer ch.Close()

	deliveries, err := ch.Consume(
		SubmissionQueue, // queue
		"",              // consumer tag — broker generates a unique one
		false,           // auto-ack disabled; we ack/nack manually
		false,           // exclusive
		false,           // no-local (not supported by RabbitMQ)
		false,           // no-wait
		nil,             // args
	)
	if err != nil {
		return fmt.Errorf("registering consumer on %q: %w", SubmissionQueue, err)
	}

	c.logger.Info("submission consumer ready, waiting for jobs",
		zap.String("queue", SubmissionQueue),
	)

	// Semaphore: limits the number of concurrently executing processors.
	sem := make(chan struct{}, c.concurrency)

	// notifyClose receives a signal when the broker forcibly closes the channel
	// (e.g. network partition, broker restart).
	chanClose := ch.NotifyClose(make(chan *amqp.Error, 1))

	for {
		select {
		case <-ctx.Done():
			// Drain the semaphore — wait for all in-flight processors to finish.
			c.drainSemaphore(sem)
			return nil

		case amqpErr, ok := <-chanClose:
			if !ok || amqpErr == nil {
				// Channel closed without error — probably because the connection
				// was re-established by WatchReconnect.
				c.drainSemaphore(sem)
				return fmt.Errorf("amqp channel closed")
			}
			c.drainSemaphore(sem)
			return fmt.Errorf("amqp channel closed by broker: code=%d reason=%s",
				amqpErr.Code, amqpErr.Reason)

		case delivery, ok := <-deliveries:
			if !ok {
				// Deliveries channel closed.
				c.drainSemaphore(sem)
				return fmt.Errorf("deliveries channel closed")
			}

			// Acquire a worker slot (blocks if all workers are busy).
			sem <- struct{}{}

			go func(d amqp.Delivery) {
				defer func() { <-sem }()
				c.handleDelivery(ctx, d)
			}(delivery)
		}
	}
}

// handleDelivery deserialises a single delivery and calls the processor.
// ACK / NACK decisions are made here based on whether the message is a
// re-delivery (i.e. was already tried once).
func (c *SubmissionConsumer) handleDelivery(ctx context.Context, d amqp.Delivery) {
	logger := c.logger.With(zap.String("message_id", d.MessageId))

	var job SubmissionJob
	if err := json.Unmarshal(d.Body, &job); err != nil {
		// Malformed message — nack without requeue so it goes to the DLX.
		logger.Error("failed to unmarshal submission job; sending to dead-letter queue",
			zap.Error(err),
			zap.ByteString("body", d.Body),
		)
		_ = d.Nack(false, false)
		return
	}

	logger = logger.With(
		zap.String("submission_id", job.SubmissionID.String()),
		zap.String("assignment_id", job.AssignmentID.String()),
		zap.Bool("redelivered", d.Redelivered),
		zap.Duration("queue_latency", time.Since(job.EnqueuedAt)),
	)

	logger.Info("processing submission job")

	if err := c.processor(ctx, job); err != nil {
		if d.Redelivered {
			// Second failure — give up and forward to dead-letter queue.
			logger.Error("submission job failed on retry; sending to dead-letter queue",
				zap.Error(err),
			)
			_ = d.Nack(false, false) // requeue=false → DLX
		} else {
			// First failure — requeue for one retry.
			logger.Warn("submission job failed; requeueing for retry",
				zap.Error(err),
			)
			_ = d.Nack(false, true) // requeue=true
		}
		return
	}

	if err := d.Ack(false); err != nil {
		logger.Error("failed to ack submission job", zap.Error(err))
		return
	}

	logger.Info("submission job processed and acknowledged")
}

// openConsumerChannel opens an AMQP channel configured for manual-ack
// consumption with a QoS prefetch equal to the consumer's concurrency.
//
// Note: publisher confirms are NOT enabled on consumer channels because they
// are only needed for publishing.  We therefore bypass RabbitMQ.Channel() and
// open the channel directly.
func (c *SubmissionConsumer) openConsumerChannel() (*amqp.Channel, error) {
	c.rmq.mu.RLock()
	conn := c.rmq.conn
	c.rmq.mu.RUnlock()

	if conn == nil || conn.IsClosed() {
		return nil, fmt.Errorf("rabbitmq connection is not available")
	}

	ch, err := conn.Channel()
	if err != nil {
		return nil, fmt.Errorf("opening channel: %w", err)
	}

	// Prefetch: deliver at most `concurrency` messages before waiting for ACKs.
	if err := ch.Qos(c.concurrency, 0, false); err != nil {
		ch.Close()
		return nil, fmt.Errorf("setting QoS prefetch=%d: %w", c.concurrency, err)
	}

	return ch, nil
}

// drainSemaphore waits for all in-flight worker goroutines to finish by
// acquiring all slots of the semaphore channel.
func (c *SubmissionConsumer) drainSemaphore(sem chan struct{}) {
	for i := 0; i < cap(sem); i++ {
		sem <- struct{}{}
	}
}
