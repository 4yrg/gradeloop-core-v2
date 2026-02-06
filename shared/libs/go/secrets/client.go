// Package secrets provides a client for securely retrieving secrets from HashiCorp Vault
package secrets

import (
	"context"
	"errors"
	"fmt"
	"os"
	"time"

	vault "github.com/hashicorp/vault/api"
	"github.com/hashicorp/go-retryablehttp"
)

// Client defines the interface for secret management operations
type Client interface {
	// GetSecret retrieves a secret value by path and key
	GetSecret(ctx context.Context, path, key string) (string, error)

	// GetSecretMap retrieves all key-value pairs at the given path
	GetSecretMap(ctx context.Context, path string) (map[string]interface{}, error)

	// GetDatabaseConfig retrieves database connection configuration
	GetDatabaseConfig(ctx context.Context) (*DatabaseConfig, error)

	// GetJWTConfig retrieves JWT authentication configuration
	GetJWTConfig(ctx context.Context) (*JWTConfig, error)

	// GetRedisConfig retrieves Redis connection configuration
	GetRedisConfig(ctx context.Context) (*RedisConfig, error)

	// Close closes the client and cleans up resources
	Close() error
}

// VaultClient implements the Client interface for HashiCorp Vault
type VaultClient struct {
	client *vault.Client
	config *Config
}

// Config holds Vault client configuration
type Config struct {
	Address   string
	Token     string
	Namespace string
	MountPath string
	Timeout   time.Duration
	MaxRetries int
}

// DatabaseConfig holds database connection details
type DatabaseConfig struct {
	Username string
	Password string
	Host     string
	Port     string
	Database string
	SSLMode  string
}

// JWTConfig holds JWT authentication configuration
type JWTConfig struct {
	Secret        string
	Algorithm     string
	Expiry        string
	RefreshExpiry string
}

// RedisConfig holds Redis connection details
type RedisConfig struct {
	Host     string
	Port     string
	Password string
	DB       string
}

// NewClient creates a new Vault client with the given configuration
func NewClient(cfg *Config) (Client, error) {
	if cfg == nil {
		cfg = DefaultConfig()
	}

	// Validate configuration
	if cfg.Address == "" {
		return nil, errors.New("vault address is required")
	}

	// Create Vault API client config
	vaultConfig := vault.DefaultConfig()
	vaultConfig.Address = cfg.Address
	vaultConfig.Timeout = cfg.Timeout

	// Configure retry logic
	httpClient := vaultConfig.HttpClient
	retryClient := retryablehttp.NewClient()
	retryClient.RetryMax = cfg.MaxRetries
	retryClient.RetryWaitMin = 100 * time.Millisecond
	retryClient.RetryWaitMax = 2 * time.Second
	retryClient.Logger = nil // Disable retry logging in production
	httpClient.Transport = retryClient.HTTPClient.Transport

	// Create Vault client
	client, err := vault.NewClient(vaultConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create vault client: %w", err)
	}

	// Set authentication token
	if cfg.Token != "" {
		client.SetToken(cfg.Token)
	}

	// Set namespace if provided
	if cfg.Namespace != "" {
		client.SetNamespace(cfg.Namespace)
	}

	return &VaultClient{
		client: client,
		config: cfg,
	}, nil
}

// DefaultConfig returns default Vault configuration from environment variables
func DefaultConfig() *Config {
	return &Config{
		Address:    getEnv("VAULT_ADDR", "http://localhost:8200"),
		Token:      getEnv("VAULT_TOKEN", ""),
		Namespace:  getEnv("VAULT_NAMESPACE", ""),
		MountPath:  getEnv("VAULT_MOUNT_PATH", "secret"),
		Timeout:    30 * time.Second,
		MaxRetries: 3,
	}
}

// GetSecret retrieves a single secret value
func (vc *VaultClient) GetSecret(ctx context.Context, path, key string) (string, error) {
	secrets, err := vc.GetSecretMap(ctx, path)
	if err != nil {
		return "", err
	}

	value, ok := secrets[key]
	if !ok {
		return "", fmt.Errorf("key '%s' not found in secret path '%s'", key, path)
	}

	strValue, ok := value.(string)
	if !ok {
		return "", fmt.Errorf("value for key '%s' is not a string", key)
	}

	return strValue, nil
}

// GetSecretMap retrieves all secrets at the given path
func (vc *VaultClient) GetSecretMap(ctx context.Context, path string) (map[string]interface{}, error) {
	// Build full path with mount
	fullPath := fmt.Sprintf("%s/data/%s", vc.config.MountPath, path)

	// Read secret from Vault
	secret, err := vc.client.Logical().ReadWithContext(ctx, fullPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read secret at path '%s': %w", path, err)
	}

	if secret == nil {
		return nil, fmt.Errorf("no secret found at path '%s'", path)
	}

	// Extract data field (KV v2 structure)
	data, ok := secret.Data["data"].(map[string]interface{})
	if !ok {
		return nil, fmt.Errorf("invalid secret structure at path '%s'", path)
	}

	return data, nil
}

// GetDatabaseConfig retrieves database configuration from Vault
func (vc *VaultClient) GetDatabaseConfig(ctx context.Context) (*DatabaseConfig, error) {
	path := "database/postgres"
	secrets, err := vc.GetSecretMap(ctx, path)
	if err != nil {
		return nil, fmt.Errorf("failed to get database config: %w", err)
	}

	return &DatabaseConfig{
		Username: getString(secrets, "username"),
		Password: getString(secrets, "password"),
		Host:     getString(secrets, "host"),
		Port:     getString(secrets, "port"),
		Database: getString(secrets, "database"),
		SSLMode:  getString(secrets, "sslmode"),
	}, nil
}

// GetJWTConfig retrieves JWT configuration from Vault
func (vc *VaultClient) GetJWTConfig(ctx context.Context) (*JWTConfig, error) {
	path := "auth/jwt"
	secrets, err := vc.GetSecretMap(ctx, path)
	if err != nil {
		return nil, fmt.Errorf("failed to get JWT config: %w", err)
	}

	return &JWTConfig{
		Secret:        getString(secrets, "secret"),
		Algorithm:     getString(secrets, "algorithm"),
		Expiry:        getString(secrets, "expiry"),
		RefreshExpiry: getString(secrets, "refresh_expiry"),
	}, nil
}

// GetRedisConfig retrieves Redis configuration from Vault
func (vc *VaultClient) GetRedisConfig(ctx context.Context) (*RedisConfig, error) {
	path := "cache/redis"
	secrets, err := vc.GetSecretMap(ctx, path)
	if err != nil {
		return nil, fmt.Errorf("failed to get Redis config: %w", err)
	}

	return &RedisConfig{
		Host:     getString(secrets, "host"),
		Port:     getString(secrets, "port"),
		Password: getString(secrets, "password"),
		DB:       getString(secrets, "db"),
	}, nil
}

// Close cleans up client resources
func (vc *VaultClient) Close() error {
	// Vault client doesn't require explicit cleanup
	return nil
}

// Helper functions

func getString(m map[string]interface{}, key string) string {
	val, ok := m[key]
	if !ok {
		return ""
	}
	strVal, _ := val.(string)
	return strVal
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// ConnectionString builds a PostgreSQL connection string from DatabaseConfig
func (dc *DatabaseConfig) ConnectionString() string {
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		dc.Host, dc.Port, dc.Username, dc.Password, dc.Database, dc.SSLMode,
	)
}

// RedisAddr builds a Redis address from RedisConfig
func (rc *RedisConfig) RedisAddr() string {
	return fmt.Sprintf("%s:%s", rc.Host, rc.Port)
}
