package lti

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/config"
	"github.com/redis/go-redis/v9"
)

var (
	ErrNonceUsed = errors.New("nonce already used")
)

// NonceStore stores and validates nonces
type NonceStore struct {
	redis *redis.Client
	local *sync.Map
	ttl   time.Duration
	cfg   *config.LTIConfig
}

// NewNonceStore creates a new nonce store
func NewNonceStore(redisClient *redis.Client, ttl time.Duration, cfg *config.LTIConfig) *NonceStore {
	return &NonceStore{
		redis: redisClient,
		local: &sync.Map{},
		ttl:   ttl,
		cfg:   cfg,
	}
}

// Validate checks if nonce is valid (not yet used)
func (n *NonceStore) Validate(ctx context.Context, nonce string) error {
	if nonce == "" {
		return errors.New("empty nonce")
	}

	if n.cfg.IsMockMode() {
		return n.validateMock(ctx, nonce)
	}

	return n.validateProduction(ctx, nonce)
}

// validateMock validates nonce in mock mode (tracks for replay protection)
func (n *NonceStore) validateMock(ctx context.Context, nonce string) error {
	if _, loaded := n.local.LoadOrStore(nonce, time.Now()); loaded {
		return ErrNonceUsed
	}
	return nil
}

// validateProduction validates nonce in strict/production mode using Redis
func (n *NonceStore) validateProduction(ctx context.Context, nonce string) error {
	if n.redis == nil {
		return errors.New("redis not configured for production nonce validation")
	}

	key := fmt.Sprintf("lti:nonce:%s", nonce)
	exists, err := n.redis.Exists(ctx, key).Result()
	if err != nil {
		return fmt.Errorf("nonce validation error: %w", err)
	}
	if exists > 0 {
		return ErrNonceUsed
	}
	return nil
}

// Use marks nonce as used
func (n *NonceStore) Use(ctx context.Context, nonce string) error {
	if nonce == "" {
		return errors.New("empty nonce")
	}

	if n.cfg.IsMockMode() {
		return n.useMock(ctx, nonce)
	}

	return n.useProduction(ctx, nonce)
}

// useMock stores nonce locally in mock mode
func (n *NonceStore) useMock(ctx context.Context, nonce string) error {
	n.local.Store(nonce, time.Now())
	return nil
}

// useProduction stores nonce in Redis for production
func (n *NonceStore) useProduction(ctx context.Context, nonce string) error {
	if n.redis == nil {
		return errors.New("redis not configured for production nonce storage")
	}

	key := fmt.Sprintf("lti:nonce:%s", nonce)
	return n.redis.Set(ctx, key, "1", n.ttl).Err()
}

// CleanExpired removes expired nonces from local store (mock mode only)
func (n *NonceStore) CleanExpired() {
	if !n.cfg.IsMockMode() {
		return
	}

	now := time.Now()
	n.local.Range(func(key, value interface{}) bool {
		if ts, ok := value.(time.Time); ok {
			if now.Sub(ts) > n.ttl {
				n.local.Delete(key)
			}
		}
		return true
	})
}