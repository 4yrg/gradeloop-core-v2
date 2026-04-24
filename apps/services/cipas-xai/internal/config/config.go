package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/4yrg/gradeloop-core-v2/packages/go/env"
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
	Provider     string // openai, anthropic, ollama, openrouter, etc.
	APIKey       string
	BaseURL      string
	Model        string
	MaxTokens    int
	Temperature  float64
	Timeout      int               // in seconds
	ExtraHeaders map[string]string // Extra headers for providers like OpenRouter
}

// Load loads configuration from environment variables
func Load() (*Config, error) {
	env.Load()

	cfg := &Config{
		Server: ServerConfig{
			Port: getEnv("CIPAS_XAI_SVC_PORT", "8085"),
		},
		LLM: LLMConfig{
			Provider:     getEnv("LLM_PROVIDER", "openai"),
			APIKey:       getEnv("LLM_API_KEY", ""),
			BaseURL:      getEnv("LLM_BASE_URL", "https://api.openai.com/v1"),
			Model:        getEnv("LLM_MODEL", "gpt-4o-mini"),
			MaxTokens:    2048,
			Temperature:  0.7,
			Timeout:      60,
			ExtraHeaders: make(map[string]string),
		},
		LogLevel: getEnv("LOG_LEVEL", "info"),
	}

	// Load extra headers for providers like OpenRouter
	// Format: HTTP-Referer=https://example.com,X-Title=My App
	if extraHeadersStr := getEnv("LLM_EXTRA_HEADERS", ""); extraHeadersStr != "" {
		for _, pair := range strings.Split(extraHeadersStr, ",") {
			parts := strings.SplitN(pair, "=", 2)
			if len(parts) == 2 {
				cfg.LLM.ExtraHeaders[strings.TrimSpace(parts[0])] = strings.TrimSpace(parts[1])
			}
		}
	}

	// Override max tokens if provided
	if maxTokensStr := getEnv("LLM_MAX_TOKENS", ""); maxTokensStr != "" {
		if val, err := strconv.Atoi(maxTokensStr); err == nil {
			cfg.LLM.MaxTokens = val
		}
	}

	// Override temperature if provided
	if tempStr := getEnv("LLM_TEMPERATURE", ""); tempStr != "" {
		if val, err := strconv.ParseFloat(tempStr, 64); err == nil {
			cfg.LLM.Temperature = val
		}
	}

	return cfg, cfg.Validate()
}

// Validate validates the configuration
func (c *Config) Validate() error {
	// Allow startup with dummy key (for health check / non-production)
	if c.LLM.APIKey == "" || c.LLM.APIKey == "dummy-key-for-startup" {
		// Log warning but don't fail - allows service to start for health checks
		log.Println("WARNING: Using dummy LLM_API_KEY - XAI features will be limited")
		return nil
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
