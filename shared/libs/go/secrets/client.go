// Package secrets provides a client for securely retrieving secrets from HashiCorp Vault
package secrets

import (
	"context"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/hashicorp/go-retryablehttp"
	vault "github.com/hashicorp/vault/api"
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
	Address    string
	Token      string
	Namespace  string
	MountPath  string
	Timeout    time.Duration
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

// EnvClient implements the Client interface by reading from environment variables
type EnvClient struct{}

// NewClient creates a new secrets client. It returns an EnvClient if VAULT_ADDR is missing,
// otherwise it tries to create a VaultClient.
func NewClient(cfg *Config) (Client, error) {
	if cfg == nil {
		cfg = DefaultConfig()
	}

	// If Vault address is not provided, use environment variables directly
	if cfg.Address == "" || os.Getenv("USE_ENV_SECRETS") == "true" {
		return &EnvClient{}, nil
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
		// Fallback to EnvClient on failure if desired, or return error
		return &EnvClient{}, nil
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
		Address:    os.Getenv("VAULT_ADDR"),
		Token:      os.Getenv("VAULT_TOKEN"),
		Namespace:  os.Getenv("VAULT_NAMESPACE"),
		MountPath:  getEnv("VAULT_MOUNT_PATH", "secret"),
		Timeout:    30 * time.Second,
		MaxRetries: 3,
	}
}

// EnvClient implementation

func (ec *EnvClient) GetSecret(ctx context.Context, path, key string) (string, error) {
	return os.Getenv(key), nil
}

func (ec *EnvClient) GetSecretMap(ctx context.Context, path string) (map[string]interface{}, error) {
	// Not practically used for EnvClient in current context
	return nil, errors.New("GetSecretMap not supported for EnvClient")
}

func (ec *EnvClient) GetDatabaseConfig(ctx context.Context) (*DatabaseConfig, error) {
	return &DatabaseConfig{
		Username: getEnv("POSTGRES_USER", "postgres"),
		Password: getEnv("POSTGRES_PASSWORD", "postgres"),
		Host:     getEnv("POSTGRES_HOST", "localhost"),
		Port:     getEnv("POSTGRES_PORT", "5432"),
		Database: getEnv("POSTGRES_DB", "gradeloop"),
		SSLMode:  getEnv("POSTGRES_SSLMODE", "disable"),
	}, nil
}

func (ec *EnvClient) GetJWTConfig(ctx context.Context) (*JWTConfig, error) {
	return &JWTConfig{
		Secret:        getEnv("JWT_ACCESS_SECRET", ""),
		Algorithm:     getEnv("JWT_ALGORITHM", "HS256"),
		Expiry:        getEnv("JWT_ACCESS_EXPIRY", "15m"),
		RefreshExpiry: getEnv("JWT_REFRESH_EXPIRY", "30d"),
	}, nil
}

func (ec *EnvClient) GetRedisConfig(ctx context.Context) (*RedisConfig, error) {
	return &RedisConfig{
		Host:     getEnv("REDIS_HOST", "localhost"),
		Port:     getEnv("REDIS_PORT", "6379"),
		Password: getEnv("REDIS_PASSWORD", ""),
		DB:       getEnv("REDIS_DB", "0"),
	}, nil
}

func (ec *EnvClient) Close() error {
	return nil
}

// VaultClient methods...
// (I will keep the VaultClient methods but update NewClient to facilitate the transition)

// GetSecret retrieves a single secret value
func (vc *VaultClient) GetSecret(ctx context.Context, path, key string) (string, error) {
	// Fallback to Env if Vault is not working or if path starts with env:
	val := os.Getenv(key)
	if val != "" {
		return val, nil
	}

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
	// Check env first
	if os.Getenv("POSTGRES_HOST") != "" {
		return (&EnvClient{}).GetDatabaseConfig(ctx)
	}

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
	// Check env first
	if os.Getenv("JWT_ACCESS_SECRET") != "" {
		return (&EnvClient{}).GetJWTConfig(ctx)
	}

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
	// Check env first
	if os.Getenv("REDIS_HOST") != "" {
		return (&EnvClient{}).GetRedisConfig(ctx)
	}

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
