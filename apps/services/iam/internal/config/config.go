package config

import (
	"fmt"
	"os"
	"strconv"

	"github.com/4yrg/gradeloop-core-v2/packages/go/env"
)

// Config holds all configuration for the IAM service.
type Config struct {
	Server          ServerConfig
	Database        DatabaseConfig
	JWT             JWTConfig
	MinIO           MinIOConfig
	FrontendURL     string
	EmailServiceURL string
}

// ServerConfig holds server-related configuration.
type ServerConfig struct {
	Port          string
	EnablePrefork bool
}

// DatabaseConfig holds database connection configuration.
type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	Name     string
	SSLMode  string
}

// MinIOConfig holds MinIO connection configuration.
type MinIOConfig struct {
	Endpoint   string
	AccessKey  string
	SecretKey  string
	Bucket     string
	UseSSL     bool
	PublicHost string // base URL used to build public object URLs
}

// JWTConfig holds JWT-related configuration.
type JWTConfig struct {
	SecretKey          string
	AccessTokenExpiry  int64  // in minutes
	RefreshTokenExpiry int64  // in days
	CookieSecure       bool   // whether to set Secure flag on cookies
	CookieSameSite     string // SameSite setting for cookies
}

// Load reads configuration from environment variables.
func Load() (*Config, error) {
	env.Load()

	dbPort := getEnv("GRA_DB_PORT", "5432")
	dbSSLMode := getEnv("GRA_DB_SSLMODE", "disable")

	return &Config{
		Server: ServerConfig{
			Port:          getEnv("IAM_SVC_PORT", "8081"),
			EnablePrefork: getEnvAsBool("ENABLE_PREFORK", false),
		},
		Database: DatabaseConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     dbPort,
			User:     getEnv("GRA_DB_USER", "postgres"),
			Password: getEnv("GRA_DB_PASSWORD", ""),
			Name:     getEnv("IAM_SVC_DB_NAME", "iam_db"),
			SSLMode:  dbSSLMode,
		},
		JWT: JWTConfig{
			SecretKey:          getEnv("JWT_SECRET_KEY", ""),
			AccessTokenExpiry:  getEnvAsInt64("JWT_ACCESS_TOKEN_EXPIRY", 15), // 15 minutes
			RefreshTokenExpiry: getEnvAsInt64("JWT_REFRESH_TOKEN_EXPIRY", 7), // 7 days
			CookieSecure:       getEnvAsBool("JWT_COOKIE_SECURE", false),
			CookieSameSite:     getEnv("JWT_COOKIE_SAMESITE", "Lax"),
		},
		MinIO: MinIOConfig{
			Endpoint:   getEnv("MINIO_ENDPOINT", "minio:9000"),
			AccessKey:  getEnv("MINIO_ACCESS_KEY", "minioadmin"),
			SecretKey:  getEnv("MINIO_SECRET_KEY", "minioadmin"),
			Bucket:     getEnv("MINIO_BUCKET", "avatars"),
			UseSSL:     getEnvAsBool("MINIO_USE_SSL", false),
			PublicHost: getEnv("MINIO_PUBLIC_HOST", "http://localhost:9000"),
		},
		FrontendURL:     getEnv("FRONTEND_URL", "http://localhost:3000"),
		EmailServiceURL: getEnv("EMAIL_SERVICE_URL", "http://localhost:8082"),
	}, nil
}

// DSN returns the database connection string.
func (c *Config) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		c.Database.Host,
		c.Database.Port,
		c.Database.User,
		c.Database.Password,
		c.Database.Name,
		c.Database.SSLMode,
	)
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsBool(key string, defaultValue bool) bool {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	result, err := strconv.ParseBool(value)
	if err != nil {
		return defaultValue
	}
	return result
}

func getEnvAsInt64(key string, defaultValue int64) int64 {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	result, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		return defaultValue
	}
	return result
}
