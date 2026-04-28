package jwks

import (
	"context"
	"crypto/rsa"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// Provider manages JWKS keys from Keycloak
type Provider struct {
	mu        sync.RWMutex
	keys      map[string]*rsa.PublicKey
	lastFetch time.Time
	ttl       time.Duration
	url       string
	redis     *redis.Client
	env       string // "local" or "production"
}

// NewProvider creates a new JWKS provider
func NewProvider(url string, redisClient *redis.Client, env string, ttl time.Duration) *Provider {
	return &Provider{
		keys:  make(map[string]*rsa.PublicKey),
		url:   url,
		redis: redisClient,
		env:   env,
		ttl:   ttl,
	}
}

// Refresh refreshes JWKS keys if needed
func (p *Provider) Refresh(ctx context.Context) error {
	if time.Since(p.lastFetch) > p.ttl {
		return p.fetchFromKeycloak(ctx)
	}
	return nil
}

// fetchFromKeycloak fetches JWKS from Keycloak
func (p *Provider) fetchFromKeycloak(ctx context.Context) error {
	// Try Redis cache first
	if p.redis != nil {
		cacheKey := fmt.Sprintf("jwks:%s", p.env)
		cached, err := p.redis.Get(ctx, cacheKey).Result()
		if err == nil && cached != "" {
			var keys map[string]*rsa.PublicKey
			if json.Unmarshal([]byte(cached), &keys) == nil {
				p.mu.Lock()
				p.keys = keys
				p.lastFetch = time.Now()
				p.mu.Unlock()
				return nil
			}
		}
	}

	// Determine HTTP client based on environment
	httpClient := &http.Client{
		Timeout: 10 * time.Second,
	}

	if p.env == "local" {
		// Local: skip TLS verification
		httpClient.Transport = &http.Transport{
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: true,
			},
		}
	}
	// Production: use default (verify TLS)

	// Fetch from Keycloak
	resp, err := httpClient.Get(p.url)
	if err != nil {
		return fmt.Errorf("fetching JWKS: %w", err)
	}
	defer resp.Body.Close()

	// Parse JWKS response
	var jwks struct {
		Keys []struct {
			Kid string `json:"kid"`
			Kty string `json:"kty"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		return fmt.Errorf("parsing JWKS: %w", err)
	}

	// Parse RSA keys
	p.mu.Lock()
	for _, key := range jwks.Keys {
		if key.Kty != "RSA" {
			continue
		}
		pubKey, err := parseRSAPublicKey(key.N, key.E)
		if err != nil {
			continue
		}
		p.keys[key.Kid] = pubKey
	}
	p.lastFetch = time.Now()
	p.mu.Unlock()

	// Update Redis cache
	if p.redis != nil {
		p.mu.RLock()
		if data, err := json.Marshal(p.keys); err == nil {
			cacheKey := fmt.Sprintf("jwks:%s", p.env)
			p.redis.Set(ctx, cacheKey, string(data), p.ttl)
		}
		p.mu.RUnlock()
	}

	return nil
}

// GetKey retrieves a public key by kid
func (p *Provider) GetKey(kid string) (*rsa.PublicKey, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()
	if key, ok := p.keys[kid]; ok {
		return key, nil
	}
	return nil, errors.New("key not found: " + kid)
}

// parseRSAPublicKey parses RSA public key from JWK components
func parseRSAPublicKey(nStr, eStr string) (*rsa.PublicKey, error) {
	// Try RawURLEncoding first, then StdEncoding
	nBytes, err := base64.RawURLEncoding.DecodeString(nStr)
	if err != nil {
		nBytes, err = base64.StdEncoding.DecodeString(nStr)
		if err != nil {
			return nil, err
		}
	}

	eBytes, err := base64.StdEncoding.DecodeString(eStr)
	if err != nil {
		return nil, err
	}

	n := new(big.Int).SetBytes(nBytes)
	e := int(new(big.Int).SetBytes(eBytes).Int64())

	return &rsa.PublicKey{N: n, E: e}, nil
}

// GetLastFetchTime returns the last fetch time
func (p *Provider) GetLastFetchTime() time.Time {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.lastFetch
}

// GetKeyCount returns the number of cached keys
func (p *Provider) GetKeyCount() int {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return len(p.keys)
}

// ClearKeys clears all cached keys
func (p *Provider) ClearKeys() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.keys = make(map[string]*rsa.PublicKey)
	p.lastFetch = time.Time{}
}
