package config

import (
	"os"
	"strconv"

	"github.com/4yrg/gradeloop-core-v2/packages/go/env"
)

type Config struct {
	App      AppConfig
	DB       DBConfig
	RabbitMQ RabbitMQConfig
	SMTP     SMTPConfig
}

type AppConfig struct {
	Port string
	Env  string
}

type DBConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	Name     string
	SSLMode  string
}

type RabbitMQConfig struct {
	URL string
}

type SMTPConfig struct {
	Host      string
	Port      int
	Username  string
	Password  string
	EmailFrom string
}

func LoadConfig() *Config {
	env.Load()

	return &Config{
		App: AppConfig{
			Port: getEnv("EMAIL_SVC_PORT", "8082"),
			Env:  getEnv("APP_ENV", "development"),
		},
		DB: DBConfig{
			Host:     getEnv("GRA_DB_HOST", "localhost"),
			Port:     getEnv("GRA_DB_PORT", "5432"),
			User:     getEnv("GRA_DB_USER", "postgres"),
			Password: getEnv("GRA_DB_PASSWORD", "postgres"),
			Name:     getEnv("EMAIL_SVC_DB_NAME", "email-db"),
			SSLMode:  getEnv("GRA_DB_SSLMODE", "disable"),
		},
		RabbitMQ: RabbitMQConfig{
			URL: getEnv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/"),
		},
		SMTP: SMTPConfig{
			Host:      getEnv("SMTP_HOST", "localhost"),
			Port:      getEnvAsInt("SMTP_PORT", 1025),
			Username:  getEnv("SMTP_USER", getEnv("SMTP_USERNAME", "")),
			Password:  getEnv("SMTP_PASS", getEnv("SMTP_PASSWORD", "")),
			EmailFrom: getEnv("EMAIL_FROM", "noreply@gradeloop.com"),
		},
	}
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}

func getEnvAsInt(key string, fallback int) int {
	valueStr := getEnv(key, "")
	if value, err := strconv.Atoi(valueStr); err == nil {
		return value
	}
	return fallback
}
