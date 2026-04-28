package redis

import (
	"context"
	"encoding/json"
	"fmt"

	notifier "github.com/4yrg/gradeloop-core-v2/packages/go/notifier"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

const (
	channelPrefix  = "notifications:"
	broadcastChannel = "notifications:broadcast"
)

type PubSub struct {
	client *redis.Client
	logger *zap.Logger
}

func NewPubSub(url string, logger *zap.Logger) (*PubSub, error) {
	opts, err := redis.ParseURL(url)
	if err != nil {
		return nil, fmt.Errorf("redis: parsing URL: %w", err)
	}

	client := redis.NewClient(opts)
	if err := client.Ping(context.Background()).Err(); err != nil {
		return nil, fmt.Errorf("redis: ping failed: %w", err)
	}

	logger.Info("redis: connected", zap.String("url", url))
	return &PubSub{client: client, logger: logger}, nil
}

func (ps *PubSub) Publish(ctx context.Context, userID string, data any) error {
	channel := channelPrefix + userID
	payload, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("redis: marshaling payload: %w", err)
	}
	return ps.client.Publish(ctx, channel, payload).Err()
}

func (ps *PubSub) PublishBroadcast(ctx context.Context, data any) error {
	payload, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("redis: marshaling payload: %w", err)
	}
	return ps.client.Publish(ctx, broadcastChannel, payload).Err()
}

func (ps *PubSub) Subscribe(ctx context.Context, userIDs []string) (<-chan *redis.Message, error) {
	channels := make([]string, 0, len(userIDs)+1)
	for _, uid := range userIDs {
		channels = append(channels, channelPrefix+uid)
	}
	channels = append(channels, broadcastChannel)

	sub := ps.client.Subscribe(ctx, channels...)
	_, err := sub.Receive(ctx)
	if err != nil {
		return nil, fmt.Errorf("redis: subscribe failed: %w", err)
	}
	return sub.Channel(), nil
}

func (ps *PubSub) Unsubscribe(ctx context.Context, userIDs []string) error {
	channels := make([]string, 0, len(userIDs))
	for _, uid := range userIDs {
		channels = append(channels, channelPrefix+uid)
	}
	return nil
}

func (ps *PubSub) Close() error {
	return ps.client.Close()
}

func (ps *PubSub) Client() *redis.Client {
	return ps.client
}

func PublishNotification(ctx context.Context, ps *PubSub, notification *notifier.Notification) error {
	for _, userID := range notification.UserIDs {
		if err := ps.Publish(ctx, userID, notification); err != nil {
			return fmt.Errorf("redis: publishing to user %s: %w", userID, err)
		}
	}
	return nil
}