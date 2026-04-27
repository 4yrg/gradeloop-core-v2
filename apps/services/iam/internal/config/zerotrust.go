package config

import (
	"os"
	"time"

	"github.com/4yrg/gradeloop-core-v2/packages/go/env"
)

// ZeroTrustConfig holds Zero Trust security configuration
type ZeroTrustConfig struct {
	// Enable Zero Trust mode
	Enabled bool

	// Mode: "relaxed" (local dev) or "strict" (production)
	Mode string

	// mTLS settings
	MTLSEnabled bool
	MTLSCertPath string
	MTLSKeyPath string

	// Device trust settings
	DeviceTrustMode string // "relaxed" or "strict"
	DeviceFingerprintRequired bool

	// Session settings
	SessionValidationInterval time.Duration
	MaxSessionAge time.Duration

	// Security settings
	RequireMFA bool
	IPReputationEnabled bool

	// Rate limiting
	RateLimitEnabled bool
	RateLimitPerMinute int
}

// LoadZeroTrustConfig loads Zero Trust configuration from environment
func LoadZeroTrustConfig() *ZeroTrustConfig {
	env.Load()

	mode := getZTString("ZERO_TRUST_MODE", "relaxed")

	return &ZeroTrustConfig{
		Enabled:      getZTBool("ZERO_TRUST_ENABLED", mode == "strict"),
		Mode:        mode,
		MTLSEnabled: getZTBool("MTLS_ENABLED", mode == "strict"),
		MTLSCertPath: getZTString("MTLS_CERT_PATH", "/certs/service.crt"),
		MTLSKeyPath:  getZTString("MTLS_KEY_PATH", "/certs/service.key"),

		DeviceTrustMode:            getZTString("DEVICE_TRUST_MODE", "relaxed"),
		DeviceFingerprintRequired: getZTBool("DEVICE_FINGERPRINT_REQUIRED", mode == "strict"),

		SessionValidationInterval: time.Duration(getZTInt("SESSION_VALIDATION_INTERVAL_SEC", 300)) * time.Second,
		MaxSessionAge:             time.Duration(getZTInt("MAX_SESSION_AGE_HOURS", 24)) * time.Hour,

		RequireMFA: getZTBool("REQUIRE_MFA", mode == "strict"),
		IPReputationEnabled: getZTBool("IP_REPUTATION_ENABLED", false),

		RateLimitEnabled: getZTBool("RATE_LIMIT_ENABLED", true),
		RateLimitPerMinute: getZTInt("RATE_LIMIT_PER_MINUTE", 100),
	}
}

// IsRelaxedMode returns true if relaxed (local dev) mode
func (c *ZeroTrustConfig) IsRelaxedMode() bool {
	return c.Mode == "relaxed"
}

// IsStrictMode returns true if strict (production) mode
func (c *ZeroTrustConfig) IsStrictMode() bool {
	return c.Mode == "strict"
}

// ShouldValidateDevice returns true if device validation is required
func (c *ZeroTrustConfig) ShouldValidateDevice() bool {
	return c.DeviceTrustMode == "strict"
}

// ShouldRequireMFA returns true if MFA is required
func (c *ZeroTrustConfig) ShouldRequireMFA() bool {
	return c.RequireMFA && c.IsStrictMode()
}

func getZTString(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getZTBool(key string, defaultValue bool) bool {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value == "true" || value == "1"
}

func getZTInt(key string, defaultValue int) int {
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