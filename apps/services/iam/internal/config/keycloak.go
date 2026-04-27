package config

import (
	"fmt"
	"os"
	"strings"
	"time"
)

type KeycloakConfig struct {
	Environment   string
	BaseURL       string
	Realm         string
	ClientID      string
	ClientSecret string
	EnforceHTTPS bool
	JWKSURL       string
	JWKSTTL       time.Duration
	DefaultTenant string
	RedirectURI  string
}

// LoadKeycloakConfig loads Keycloak configuration from environment
func LoadKeycloakConfig() (*KeycloakConfig, error) {
	env.Load()

	appEnv := getEnvString("APP_ENV", "")
	keycloakBaseURL := os.Getenv("KEYCLOAK_BASE_URL")
	keycloakRealm := getEnvString("KEYCLOAK_REALM", "gradeloop-lms")

	// Auto-detect environment and build base URL
	if appEnv == "" {
		// Auto-detect based on KEYCLOAK_BASE_URL
		if keycloakBaseURL != "" {
			if len(keycloakBaseURL) >= 5 && keycloakBaseURL[:5] == "https" {
				appEnv = "production"
			} else {
				appEnv = "local"
			}
		} else {
			appEnv = "local"
		}
	}

	// Build base URL based on environment if not provided
	if keycloakBaseURL == "" {
		if appEnv == "production" {
			keycloakBaseURL = "https://auth.gradeloop.space"
		} else {
			keycloakBaseURL = "http://localhost:8080"
		}
	}

	// Build JWKS URL
	jwksURL := fmt.Sprintf("%s/realms/%s/protocol/openid-connect/certs",
		keycloakBaseURL, keycloakRealm)

	// Parse JWKS TTL
	jwksTTL := getEnvDuration("KEYCLOAK_JWKS_TTL", 24*time.Hour)

	// Security settings
	enforceHTTPS := appEnv == "production"

	// Default tenant
	defaultTenant := getEnvString("KEYCLOAK_DEFAULT_TENANT", "")
	if defaultTenant == "" {
		if appEnv == "production" {
			defaultTenant = ""
		} else {
			defaultTenant = "dev-university"
		}
	}

	return &KeycloakConfig{
		Environment:   appEnv,
		BaseURL:       keycloakBaseURL,
		Realm:        keycloakRealm,
		ClientID:      getEnvString("KEYCLOAK_CLIENT_ID", "lms-api"),
		ClientSecret: getEnvString("KEYCLOAK_CLIENT_SECRET", ""),
		EnforceHTTPS: enforceHTTPS,
		JWKSURL:      jwksURL,
		JWKSTTL:     jwksTTL,
		DefaultTenant: defaultTenant,
		RedirectURI:  getEnvString("KEYCLOAK_REDIRECT_URI", "http://localhost:8081/api/v1/auth/keycloak/callback"),
	}, nil
}

// getEnvString is a helper to get string env var
func getEnvString(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvDuration is a helper to get duration env var
func getEnvDuration(key string, defaultValue time.Duration) time.Duration {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}

	d, err := time.ParseDuration(value)
	if err != nil {
		return defaultValue
	}
	return d
}