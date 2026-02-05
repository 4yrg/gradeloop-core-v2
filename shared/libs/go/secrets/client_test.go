package secrets

import (
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
