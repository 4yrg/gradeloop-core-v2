package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Server   ServerConfig
	LLM      LLMConfig
	LogLevel string
}

type ServerConfig struct {
	Port string
}

type LLMConfig struct {
	Provider    string // openai, anthropic, ollama, etc.
	APIKey      string
	BaseURL     string
	Model       string
	MaxTokens   int
	Temperature float64
	Timeout     int // in seconds
}

// Load loads configuration from environment variables
func Load() (*Config, error) {
	// Load .env file if it exists
	_ = godotenv.Load()

	cfg := &Config{
		Server: ServerConfig{
			Port: getEnv("SERVER_PORT", "8085"),
		},
		LLM: LLMConfig{
			Provider:    getEnv("LLM_PROVIDER", "openai"),
			APIKey:      getEnv("LLM_API_KEY", ""),
			BaseURL:     getEnv("LLM_BASE_URL", "https://api.openai.com/v1"),
			Model:       getEnv("LLM_MODEL", "gpt-4o-mini"),
			MaxTokens:   2048,
			Temperature: 0.7,
			Timeout:     60,
		},
		LogLevel: getEnv("LOG_LEVEL", "info"),
	}

	// Override max tokens if provided
	if maxTokens := getEnv("LLM_MAX_TOKENS", ""); maxTokens != "" {
		// Parse would be done in validation
		cfg.LLM.MaxTokens = 2048 // default fallback
	}

	// Override temperature if provided
	if temp := getEnv("LLM_TEMPERATURE", ""); temp != "" {
		cfg.LLM.Temperature = 0.7 // default fallback
	}

	return cfg, cfg.Validate()
}

// Validate validates the configuration
func (c *Config) Validate() error {
	if c.LLM.APIKey == "" {
		return fmt.Errorf("LLM_API_KEY is required")
	}

	if c.LLM.Model == "" {
		return fmt.Errorf("LLM_MODEL is required")
	}

	return nil
}

// getEnv gets environment variable or returns default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
