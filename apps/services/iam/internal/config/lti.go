package config

import (
	"os"
	"time"

	"github.com/4yrg/gradeloop-core-v2/packages/go/env"
)

// LTIConfig holds LTI 1.3 configuration
type LTIConfig struct {
	// Mode: "mock" (local dev) or "strict" (production)
	Mode string

	// Platform configuration
	PlatformURL  string // External LMS URL
	ClientID     string
	DeploymentID string
	KeysetURL    string // Platform JWKS URL
	Issuer       string // Platform issuer

	// Endpoints
	RedirectURI  string
	DeepLinkURI  string
	LoginInitURI string
	JWKSURI      string

	// Feature flags
	AGSEnabled         bool
	NRPSEnabled        bool
	DeepLinkingEnabled bool

	// Security
	NonceTTL time.Duration

	// Legacy LTI 1.1 support
	LTI11Enabled bool
	LTI11Secret  string
}

// LoadLTIConfig loads LTI configuration from environment
func LoadLTIConfig() *LTIConfig {
	env.Load()

	mode := getLTIEnvString("LTI_MODE", "mock")

	// If mock mode (local dev)
	if mode == "mock" {
		return &LTIConfig{
			Mode:               "mock",
			PlatformURL:        getLTIEnvString("LTI_PLATFORM_URL", "http://localhost:8080"),
			ClientID:           getLTIEnvString("LTI_CLIENT_ID", "dev-client"),
			DeploymentID:       getLTIEnvString("LTI_DEPLOYMENT_ID", "dev-deployment"),
			Issuer:             getLTIEnvString("LTI_ISSUER", "http://localhost:8080"),
			KeysetURL:          getLTIEnvString("LTI_KEYSET_URL", "http://localhost:8080/keys"),
			RedirectURI:        getLTIEnvString("LTI_REDIRECT_URI", "http://localhost:8081/lti/launch"),
			DeepLinkURI:        getLTIEnvString("LTI_DEEP_LINK_URI", "http://localhost:8081/lti/deep-link"),
			LoginInitURI:       getLTIEnvString("LTI_LOGIN_INIT_URI", "http://localhost:8081/lti/login"),
			JWKSURI:            getLTIEnvString("LTI_JWKS_URI", "http://localhost:8081/lti/.well-known/jwks"),
			AGSEnabled:         getLTIEnvBool("LTI_AGS_ENABLED", true),
			NRPSEnabled:        getLTIEnvBool("LTI_NRPS_ENABLED", true),
			DeepLinkingEnabled: getLTIEnvBool("LTI_DEEP_LINKING_ENABLED", true),
			NonceTTL:           time.Minute * 5,
			LTI11Enabled:       getLTIEnvBool("LTI_1_1_ENABLED", true),
			LTI11Secret:        getLTIEnvString("LTI_1_1_SECRET", "dev-secret"),
		}
	}

	// Production (strict) mode
	return &LTIConfig{
		Mode:               "strict",
		PlatformURL:        getLTIEnvString("LTI_PLATFORM_URL", ""),
		ClientID:           getLTIEnvString("LTI_CLIENT_ID", ""),
		DeploymentID:       getLTIEnvString("LTI_DEPLOYMENT_ID", ""),
		Issuer:             getLTIEnvString("LTI_ISSUER", ""),
		KeysetURL:          getLTIEnvString("LTI_KEYSET_URL", ""),
		RedirectURI:        getLTIEnvString("LTI_REDIRECT_URI", ""),
		DeepLinkURI:        getLTIEnvString("LTI_DEEP_LINK_URI", ""),
		LoginInitURI:       getLTIEnvString("LTI_LOGIN_INIT_URI", ""),
		JWKSURI:            getLTIEnvString("LTI_JWKS_URI", ""),
		AGSEnabled:         getLTIEnvBool("LTI_AGS_ENABLED", true),
		NRPSEnabled:        getLTIEnvBool("LTI_NRPS_ENABLED", true),
		DeepLinkingEnabled: getLTIEnvBool("LTI_DEEP_LINKING_ENABLED", true),
		NonceTTL:           time.Minute * 5,
		LTI11Enabled:       getLTIEnvBool("LTI_1_1_ENABLED", false),
		LTI11Secret:        getLTIEnvString("LTI_1_1_SECRET", ""),
	}
}

// IsMockMode returns true if mock LTI mode is enabled
func (c *LTIConfig) IsMockMode() bool {
	return c.Mode == "mock"
}

// IsStrictMode returns true if strict LTI mode is enabled
func (c *LTIConfig) IsStrictMode() bool {
	return c.Mode == "strict"
}

// IsValid returns true if configuration is valid for production
func (c *LTIConfig) IsValid() bool {
	if c.IsMockMode() {
		return true
	}
	return c.PlatformURL != "" && c.ClientID != "" && c.DeploymentID != ""
}

func getLTIEnvString(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getLTIEnvBool(key string, defaultValue bool) bool {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value == "true" || value == "1"
}
