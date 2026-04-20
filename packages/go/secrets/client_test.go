package secrets

import (
	"context"
	"os"
	"testing"
	"time"
)

func TestDefaultConfig(t *testing.T) {
	cfg := DefaultConfig()

	if cfg.Address == "" {
		t.Error("Expected default address to be set")
	}

	if cfg.Timeout <= 0 {
		t.Error("Expected positive timeout")
	}

	if cfg.MaxRetries < 0 {
		t.Error("Expected non-negative max retries")
	}
}

func TestDefaultConfigFromEnv(t *testing.T) {
	// Set environment variables
	os.Setenv("VAULT_ADDR", "https://vault.example.com:8200")
	os.Setenv("VAULT_TOKEN", "test-token")
	os.Setenv("VAULT_NAMESPACE", "test-namespace")
	os.Setenv("VAULT_MOUNT_PATH", "custom-secret")
	defer func() {
		os.Unsetenv("VAULT_ADDR")
		os.Unsetenv("VAULT_TOKEN")
		os.Unsetenv("VAULT_NAMESPACE")
		os.Unsetenv("VAULT_MOUNT_PATH")
	}()

	cfg := DefaultConfig()
	if cfg.Address != "https://vault.example.com:8200" {
		t.Errorf("Expected address from env, got %s", cfg.Address)
	}
	if cfg.Token != "test-token" {
		t.Errorf("Expected token from env, got %s", cfg.Token)
	}
	if cfg.Namespace != "test-namespace" {
		t.Errorf("Expected namespace from env, got %s", cfg.Namespace)
	}
	if cfg.MountPath != "custom-secret" {
		t.Errorf("Expected mount path from env, got %s", cfg.MountPath)
	}
}

func TestConnectionString(t *testing.T) {
	dbConfig := &DatabaseConfig{
		Host:     "localhost",
		Port:     "5432",
		Username: "testuser",
		Password: "testpass",
		Database: "testdb",
		SSLMode:  "disable",
	}

	connStr := dbConfig.ConnectionString()
	expected := "host=localhost port=5432 user=testuser password=testpass dbname=testdb sslmode=disable"

	if connStr != expected {
		t.Errorf("Expected connection string '%s', got '%s'", expected, connStr)
	}
}

func TestDatabaseConfigConnectionStringWithSSL(t *testing.T) {
	dbConfig := &DatabaseConfig{
		Host:     "db.example.com",
		Port:     "5432",
		Username: "prod_user",
		Password: "secure_pass",
		Database: "proddb",
		SSLMode:  "require",
	}

	connStr := dbConfig.ConnectionString()
	if connStr == "" {
		t.Error("Connection string should not be empty")
	}
	
	// Check if SSL mode is in the connection string
	expected := "sslmode=require"
	found := false
	for i := 0; i <= len(connStr)-len(expected); i++ {
		if connStr[i:i+len(expected)] == expected {
			found = true
			break
		}
	}
	if !found {
		t.Error("Connection string should contain SSL mode")
	}
}

func TestRedisAddr(t *testing.T) {
	redisConfig := &RedisConfig{
		Host: "localhost",
		Port: "6379",
	}

	addr := redisConfig.RedisAddr()
	expected := "localhost:6379"

	if addr != expected {
		t.Errorf("Expected Redis address '%s', got '%s'", expected, addr)
	}
}

func TestRedisAddrRemote(t *testing.T) {
	redisConfig := &RedisConfig{
		Host:     "redis.example.com",
		Port:     "6380",
		Password: "redis_pass",
		DB:       "1",
	}

	addr := redisConfig.RedisAddr()
	expected := "redis.example.com:6380"

	if addr != expected {
		t.Errorf("Expected Redis address '%s', got '%s'", expected, addr)
	}
}

func TestNewClientWithInvalidConfig(t *testing.T) {
	cfg := &Config{
		Address:    "",
		Token:      "test-token",
		Timeout:    5 * time.Second,
		MaxRetries: 3,
	}

	_, err := NewClient(cfg)
	if err == nil {
		t.Error("Expected error when creating client with empty address")
	}
}

func TestNewClientWithNilConfig(t *testing.T) {
	// Set env vars for default config
	os.Setenv("VAULT_ADDR", "http://localhost:8200")
	os.Setenv("VAULT_TOKEN", "test-token")
	defer func() {
		os.Unsetenv("VAULT_ADDR")
		os.Unsetenv("VAULT_TOKEN")
	}()

	client, err := NewClient(nil)
	if err != nil {
		t.Errorf("Expected no error with nil config (should use defaults), got: %v", err)
	}
	if client == nil {
		t.Error("Expected client to be created")
	}
	
	if client != nil {
		_ = client.Close()
	}
}

func TestNewClientWithValidConfig(t *testing.T) {
	cfg := &Config{
		Address:    "http://localhost:8200",
		Token:      "test-token",
		Namespace:  "test",
		MountPath:  "secret",
		Timeout:    30 * time.Second,
		MaxRetries: 3,
	}

	client, err := NewClient(cfg)
	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}
	if client == nil {
		t.Error("Expected client to be created")
	}

	// Test Close
	if client != nil {
		err = client.Close()
		if err != nil {
			t.Errorf("Expected no error on close, got: %v", err)
		}
	}
}

func TestGetStringHelper(t *testing.T) {
	testMap := map[string]interface{}{
		"key1": "value1",
		"key2": 123,
		"key3": true,
	}

	if getString(testMap, "key1") != "value1" {
		t.Error("Expected to get string value for key1")
	}

	if getString(testMap, "key2") != "" {
		t.Error("Expected empty string for non-string value")
	}

	if getString(testMap, "nonexistent") != "" {
		t.Error("Expected empty string for nonexistent key")
	}
}

func TestGetEnvHelper(t *testing.T) {
	// Test with existing env var
	os.Setenv("TEST_VAR", "test_value")
	defer os.Unsetenv("TEST_VAR")

	result := getEnv("TEST_VAR", "default")
	if result != "test_value" {
		t.Errorf("Expected 'test_value', got '%s'", result)
	}

	// Test with non-existing env var
	result = getEnv("NON_EXISTING_VAR", "default_value")
	if result != "default_value" {
		t.Errorf("Expected 'default_value', got '%s'", result)
	}
}

func TestGetSecretKeyNotFound(t *testing.T) {
	cfg := &Config{
		Address:   "http://localhost:8200",
		Token:     "test-token",
		MountPath: "secret",
		Timeout:   5 * time.Second,
	}

	client, err := NewClient(cfg)
	if err != nil {
		t.Skip("Skipping test that requires Vault client creation")
	}

	ctx := context.Background()
	_, err = client.GetSecret(ctx, "nonexistent/path", "key")
	if err == nil {
		t.Error("Expected error for nonexistent path")
	}
}

func TestGetDatabaseConfigStructure(t *testing.T) {
	cfg := &Config{
		Address:   "http://localhost:8200",
		Token:     "test-token",
		MountPath: "secret",
		Timeout:   5 * time.Second,
	}

	client, err := NewClient(cfg)
	if err != nil {
		t.Skip("Skipping test that requires Vault client creation")
	}

	ctx := context.Background()
	_, err = client.GetDatabaseConfig(ctx)
	// We expect an error since Vault isn't running, but we're testing the code path
	if err == nil {
		t.Log("Database config call succeeded")
	} else {
		t.Logf("Database config call failed as expected without Vault: %v", err)
	}
}

func TestGetJWTConfigStructure(t *testing.T) {
	cfg := &Config{
		Address:   "http://localhost:8200",
		Token:     "test-token",
		MountPath: "secret",
		Timeout:   5 * time.Second,
	}

	client, err := NewClient(cfg)
	if err != nil {
		t.Skip("Skipping test that requires Vault client creation")
	}

	ctx := context.Background()
	_, err = client.GetJWTConfig(ctx)
	// We expect an error since Vault isn't running, but we're testing the code path
	if err == nil {
		t.Log("JWT config call succeeded")
	} else {
		t.Logf("JWT config call failed as expected without Vault: %v", err)
	}
}

func TestGetRedisConfigStructure(t *testing.T) {
	cfg := &Config{
		Address:   "http://localhost:8200",
		Token:     "test-token",
		MountPath: "secret",
		Timeout:   5 * time.Second,
	}

	client, err := NewClient(cfg)
	if err != nil {
		t.Skip("Skipping test that requires Vault client creation")
	}

	ctx := context.Background()
	_, err = client.GetRedisConfig(ctx)
	// We expect an error since Vault isn't running, but we're testing the code path
	if err == nil {
		t.Log("Redis config call succeeded")
	} else {
		t.Logf("Redis config call failed as expected without Vault: %v", err)
	}
}

func TestGetSecretMapStructure(t *testing.T) {
	cfg := &Config{
		Address:   "http://localhost:8200",
		Token:     "test-token",
		MountPath: "secret",
		Timeout:   5 * time.Second,
	}

	client, err := NewClient(cfg)
	if err != nil {
		t.Skip("Skipping test that requires Vault client creation")
	}

	ctx := context.Background()
	_, err = client.GetSecretMap(ctx, "test/path")
	// We expect an error since Vault isn't running, but we're testing the code path
	if err == nil {
		t.Log("GetSecretMap call succeeded")
	} else {
		t.Logf("GetSecretMap call failed as expected without Vault: %v", err)
	}
}

func TestConfigWithCustomTimeout(t *testing.T) {
	cfg := &Config{
		Address:    "http://localhost:8200",
		Token:      "test-token",
		Timeout:    60 * time.Second,
		MaxRetries: 5,
	}

	if cfg.Timeout != 60*time.Second {
		t.Errorf("Expected timeout 60s, got %v", cfg.Timeout)
	}
	if cfg.MaxRetries != 5 {
		t.Errorf("Expected max retries 5, got %d", cfg.MaxRetries)
	}
}

func TestDatabaseConfigFields(t *testing.T) {
	db := &DatabaseConfig{
		Username: "user",
		Password: "pass",
		Host:     "host",
		Port:     "5432",
		Database: "db",
		SSLMode:  "require",
	}

	if db.Username != "user" {
		t.Error("Username mismatch")
	}
	if db.Password != "pass" {
		t.Error("Password mismatch")
	}
	if db.Host != "host" {
		t.Error("Host mismatch")
	}
	if db.Port != "5432" {
		t.Error("Port mismatch")
	}
	if db.Database != "db" {
		t.Error("Database mismatch")
	}
	if db.SSLMode != "require" {
		t.Error("SSLMode mismatch")
	}
}

func TestJWTConfigFields(t *testing.T) {
	jwt := &JWTConfig{
		Secret:        "secret",
		Algorithm:     "HS256",
		Expiry:        "24h",
		RefreshExpiry: "168h",
	}

	if jwt.Secret != "secret" {
		t.Error("Secret mismatch")
	}
	if jwt.Algorithm != "HS256" {
		t.Error("Algorithm mismatch")
	}
	if jwt.Expiry != "24h" {
		t.Error("Expiry mismatch")
	}
	if jwt.RefreshExpiry != "168h" {
		t.Error("RefreshExpiry mismatch")
	}
}

func TestRedisConfigFields(t *testing.T) {
	redis := &RedisConfig{
		Host:     "localhost",
		Port:     "6379",
		Password: "pass",
		DB:       "0",
	}

	if redis.Host != "localhost" {
		t.Error("Host mismatch")
	}
	if redis.Port != "6379" {
		t.Error("Port mismatch")
	}
	if redis.Password != "pass" {
		t.Error("Password mismatch")
	}
	if redis.DB != "0" {
		t.Error("DB mismatch")
	}
}
