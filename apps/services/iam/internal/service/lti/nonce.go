package lti

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

var (
	ErrNonceUsed = errors.New("nonce already used")
)

// NonceStore stores and validates nonces
type NonceStore struct {
	redis *redis.Client
	local *sync.Map // For mock mode
	ttl   time.Duration
	env  string
}

// NewNonceStore creates a new nonce store
func NewNonceStore(redisClient *redis.Client, ttl time.Duration, env string) *NonceStore {
	return &NonceStore{
		redis: redisClient,
		local: &sync.Map{},
		ttl:   ttl,
		env:  env,
	}
}

// Validate checks if nonce is valid (not yet used)
func (n *NonceStore) Validate(ctx context.Context, nonce string) error {
	// Mock mode: accept any nonce
	if n.env == "local" || n.env == "mock" {
		return nil
	}

	// Production: use Redis
	key := fmt.Sprintf("lti:nonce:%s", nonce)
	exists, err := n.redis.Exists(ctx, key).Result()
	if err != nil {
		return err
	}
	if exists > 0 {
		return ErrNonceUsed
	}
	return nil
}

// Use marks nonce as used
func (n *NonceStore) Use(ctx context.Context, nonce string) error {
	// Mock mode: store locally
	if n.env == "local" || n.env == "mock" {
		n.local.Store(nonce, time.Now())
		return nil
	}

	// Production: use Redis with TTL
	key := fmt.Sprintf("lti:nonce:%s", nonce)
	return n.redis.Set(ctx, key, "1", n.ttl).Err()
}

// CleanExpired removes expired nonces (for local mode cleanup)
func (n *NonceStore) CleanExpired() {
	if n.env != "local" && n.env != "mock" {
		return
	}

	now := time.Now()
	n.local.Range(func(key, value interface{}) bool {
		ts := value.(time.Time)
		if now.Sub(ts) > n.ttl {
			n.local.Delete(key)
		}
		return true
	})
}