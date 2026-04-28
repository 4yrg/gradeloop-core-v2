package config

import (
	"os"
	"time"

	"github.com/4yrg/gradeloop-core-v2/packages/go/env"
)

// AuthzConfig holds authorization configuration
type AuthzConfig struct {
	// Mode: "permissive" (local dev) or "strict" (production)
	Mode string

	// Row Level Security enforcement
	RLSEnabled bool

	// Audit logging
	AuditEnabled   bool
	AuditRetention time.Duration

	// Cache settings
	PolicyCacheTTL time.Duration

	// Time-based permissions
	TimeAwareEnabled bool
}

// LoadAuthzConfig loads authorization configuration from environment
func LoadAuthzConfig() *AuthzConfig {
	env.Load()

	mode := os.Getenv("AUTHZ_MODE")
	if mode == "" {
		mode = "permissive"
	}

	return &AuthzConfig{
		Mode:             mode,
		RLSEnabled:       mode == "strict",
		AuditEnabled:     getAuthzBool("AUTHZ_AUDIT_ENABLED", true),
		AuditRetention:   time.Duration(getAuthzInt("AUTHZ_AUDIT_RETENTION_DAYS", 90)) * 24 * time.Hour,
		PolicyCacheTTL:   time.Duration(getAuthzInt("AUTHZ_POLICY_CACHE_MINUTES", 5)) * time.Minute,
		TimeAwareEnabled: getAuthzBool("AUTHZ_TIME_AWARE", false),
	}
}

// IsPermissiveMode returns true if permissive (local dev) mode
func (c *AuthzConfig) IsPermissiveMode() bool {
	return c.Mode == "permissive"
}

// IsStrictMode returns true if strict (production) mode
func (c *AuthzConfig) IsStrictMode() bool {
	return c.Mode == "strict"
}

// ShouldAudit returns true if audit logging is enabled
func (c *AuthzConfig) ShouldAudit() bool {
	return c.AuditEnabled && c.IsStrictMode()
}

func getAuthzString(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getAuthzBool(key string, defaultValue bool) bool {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value == "true" || value == "1"
}

func getAuthzInt(key string, defaultValue int) int {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	var result int
	for _, c := range value {
		if c >= '0' && c <= '9' {
			result = result*10 + int(c-'0')
		}
	}
	return result
}
