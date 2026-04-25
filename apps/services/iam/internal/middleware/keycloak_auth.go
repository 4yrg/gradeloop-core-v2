package middleware

import (
	"context"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
	"github.com/redis/go-redis/v9"
)

// KeycloakClaims represents claims from Keycloak JWT token
type KeycloakClaims struct {
	Sub              string   `json:"sub"`
	Iss              string   `json:"iss"`
	Aud              any      `json:"aud"`
	TenantID         string   `json:"tenant_id"`
	Email            string   `json:"email"`
	Name             string   `json:"name"`
	GivenName        string   `json:"given_name"`
	FamilyName       string   `json:"family_name"`
	PreferredUsername string   `json:"preferred_username"`
	Roles            []string `json:"https://gradeloop.edu/claims/roles"`
	Permissions      []string `json:"https://gradeloop.edu/claims/permissions"`
	jwt.RegisteredClaims
}

// JWKSKeyStore manages RSA public keys from Keycloak
type JWKSKeyStore struct {
	mu        sync.RWMutex
	keys      map[string]*rsa.PublicKey
	lastFetch time.Time
	ttl       time.Duration
	jwksURL   string
	redis     *redis.Client
}

type JWKSKeyStoreOption func(*JWKSKeyStore)

// WithJWKSKeyTTL sets the cache TTL for JWKS keys
func WithJWKSKeyTTL(ttl time.Duration) JWKSKeyStoreOption {
	return func(k *JWKSKeyStore) { k.ttl = ttl }
}

// WithJWKSRedis sets the Redis client for caching
func WithJWKSRedis(r *redis.Client) JWKSKeyStoreOption {
	return func(k *JWKSKeyStore) { k.redis = r }
}

// NewJWKSKeyStore creates a new JWKS key store
func NewJWKSKeyStore(jwksURL string, opts ...JWKSKeyStoreOption) *JWKSKeyStore {
	ks := &JWKSKeyStore{
		keys:  make(map[string]*rsa.PublicKey),
		jwksURL: jwksURL,
		ttl:    24 * time.Hour,
	}
	for _, opt := range opts {
		opt(ks)
	}
	return ks
}

// Refresh fetches and caches JWKS keys from Keycloak
func (ks *JWKSKeyStore) Refresh(ctx context.Context) error {
	// Try Redis cache first
	if ks.redis != nil {
		cached, err := ks.redis.Get(ctx, "jwks:keys").Result()
		if err == nil && cached != "" {
			var keys map[string]*rsa.PublicKey
			if json.Unmarshal([]byte(cached), &keys) == nil {
				ks.mu.Lock()
				ks.keys = keys
				ks.lastFetch = time.Now()
				ks.mu.Unlock()
				return nil
			}
		}
	}

	// Fetch from Keycloak
	resp, err := http.Get(ks.jwksURL)
	if err != nil {
		return fmt.Errorf("fetching JWKS: %w", err)
	}
	defer resp.Body.Close()

	var jwks struct {
		Keys []struct {
			Kid string `json:"kid"`
			Kty string `json:"kty"`
			Alg string `json:"alg"`
			Use string `json:"use"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		return fmt.Errorf("parsing JWKS: %w", err)
	}

	ks.mu.Lock()
	for _, key := range jwks.Keys {
		if key.Kty != "RSA" {
			continue
		}
		nBytes, err := base64.RawURLEncoding.DecodeString(key.N)
		if err != nil {
			nBytes, err = base64.StdEncoding.DecodeString(key.N)
			if err != nil {
				continue
			}
		}
		eBytes, err := base64.StdEncoding.DecodeString(key.E)
		if err != nil {
			continue
		}
		n := new(big.Int).SetBytes(nBytes)
		e := int(new(big.Int).SetBytes(eBytes).Int64())
		ks.keys[key.Kid] = &rsa.PublicKey{N: n, E: e}
	}
	ks.lastFetch = time.Now()
	ks.mu.Unlock()

	// Update Redis cache
	if ks.redis != nil {
		ks.mu.RLock()
		if data, err := json.Marshal(ks.keys); err == nil {
			ks.redis.Set(ctx, "jwks:keys", string(data), ks.ttl)
		}
		ks.mu.RUnlock()
	}

	return nil
}

// GetKey retrieves a public key by its ID
func (ks *JWKSKeyStore) GetKey(kid string) (*rsa.PublicKey, error) {
	ks.mu.RLock()
	defer ks.mu.RUnlock()
	if key, ok := ks.keys[kid]; ok {
		return key, nil
	}
	return nil, fmt.Errorf("key not found: %s", kid)
}

// KeycloakAuthMiddleware validates RS256 tokens from Keycloak
func KeycloakAuthMiddleware(jwks *JWKSKeyStore) fiber.Handler {
	return func(c fiber.Ctx) error {
		// Check if refresh needed
		if time.Since(jwks.lastFetch) > jwks.ttl {
			if err := jwks.Refresh(c.RequestCtx()); err != nil {
				fmt.Printf("JWKS refresh failed: %v\n", err)
			}
		}

		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return fiber.NewError(fiber.StatusUnauthorized, "Missing authorization header")
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			return fiber.NewError(fiber.StatusUnauthorized, "Invalid authorization format")
		}

		tokenString := parts[1]
		token, err := jwt.ParseWithClaims(
			tokenString,
			&KeycloakClaims{},
			func(t *jwt.Token) (interface{}, error) {
				if _, ok := t.Method.(*jwt.SigningMethodRSA); !ok {
					return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
				}
				kid, ok := t.Header["kid"].(string)
				if !ok {
					return nil, errors.New("missing key ID in token")
				}
				key, err := jwks.GetKey(kid)
				if err != nil {
					return nil, err
				}
				return key, nil
			},
		)
		if err != nil {
			return fiber.NewError(fiber.StatusUnauthorized, "Invalid token")
		}

		claims, ok := token.Claims.(*KeycloakClaims)
		if !ok || !token.Valid {
			return fiber.NewError(fiber.StatusUnauthorized, "Invalid claims")
		}

		// Store claims in context for handlers to access
		c.Locals("user_id", claims.Sub)
		c.Locals("tenant_id", claims.TenantID)
		c.Locals("email", claims.Email)
		c.Locals("name", claims.Name)
		c.Locals("given_name", claims.GivenName)
		c.Locals("family_name", claims.FamilyName)
		c.Locals("preferred_username", claims.PreferredUsername)
		c.Locals("roles", claims.Roles)
		c.Locals("permissions", claims.Permissions)

		// Backward compatibility: map roles to user_type
		userType := "student"
		if len(claims.Roles) > 0 {
			userType = claims.Roles[0]
		}
		c.Locals("user_type", userType)

		return c.Next()
	}
}

// KeycloakRequireRole creates middleware that checks for required role
func KeycloakRequireRole(roles ...string) fiber.Handler {
	return func(c fiber.Ctx) error {
		userRoles, ok := c.Locals("roles").([]string)
		if !ok || len(userRoles) == 0 {
			return fiber.NewError(fiber.StatusForbidden, "No roles found")
		}
		for _, role := range roles {
			for _, userRole := range userRoles {
				if role == userRole {
					return c.Next()
				}
			}
		}
		return fiber.NewError(fiber.StatusForbidden, "Insufficient privileges")
	}
}

// KeycloakRequirePermission creates middleware that checks for required permission
func KeycloakRequirePermission(perms ...string) fiber.Handler {
	return func(c fiber.Ctx) error {
		userPerms, ok := c.Locals("permissions").([]string)
		if !ok || len(userPerms) == 0 {
			return fiber.NewError(fiber.StatusForbidden, "No permissions found")
		}
		for _, perm := range perms {
			for _, userPerm := range userPerms {
				if perm == userPerm {
					return c.Next()
				}
			}
		}
		return fiber.NewError(fiber.StatusForbidden, "Insufficient permissions")
	}
}

// KeycloakRequireTenant creates middleware that validates tenant access
func KeycloakRequireTenant(allowedTenantIDs ...string) fiber.Handler {
	return func(c fiber.Ctx) error {
		if len(allowedTenantIDs) == 0 {
			return c.Next()
		}
		tenantID, ok := c.Locals("tenant_id").(string)
		if !ok || tenantID == "" {
			return fiber.NewError(fiber.StatusForbidden, "Tenant not specified")
		}
		for _, tid := range allowedTenantIDs {
			if tenantID == tid {
				return c.Next()
			}
		}
		return fiber.NewError(fiber.StatusForbidden, "Tenant not allowed")
	}
}

// KeycloakExtractTenant extracts tenant_id from token claims
func KeycloakExtractTenant(c fiber.Ctx) (string, error) {
	tenantID, ok := c.Locals("tenant_id").(string)
	if !ok || tenantID == "" {
		return "", errors.New("tenant not found in token")
	}
	return tenantID, nil
}

// KeycloakExtractUserID extracts user_id from token claims
func KeycloakExtractUserID(c fiber.Ctx) (string, error) {
	userID, ok := c.Locals("user_id").(string)
	if !ok || userID == "" {
		return "", errors.New("user not found in token")
	}
	return userID, nil
}

// KeycloakExtractRoles extracts roles from token claims
func KeycloakExtractRoles(c fiber.Ctx) []string {
	roles, ok := c.Locals("roles").([]string)
	if !ok {
		return nil
	}
	return roles
}

// KeycloakExtractPermissions extracts permissions from token claims
func KeycloakExtractPermissions(c fiber.Ctx) []string {
	perms, ok := c.Locals("permissions").([]string)
	if !ok {
		return nil
	}
	return perms
}