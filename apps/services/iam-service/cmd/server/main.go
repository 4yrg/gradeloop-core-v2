package main

import (
	"os"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/app"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/config"
)

func main() {
	// Initialize logger
	zerolog.SetGlobalLevel(zerolog.InfoLevel)
	if os.Getenv("DEBUG") == "true" {
		zerolog.SetGlobalLevel(zerolog.DebugLevel)
	}

	log.Info().Msg("Starting IAM Service...")

	// Load configuration
	cfg := config.LoadConfig()

	// Create new application
	application, err := app.New(cfg)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize application")
	}

	// Get port from environment or use default
	port := getEnvOrDefault("PORT", "8080")

	// Start the server
	if err := application.Start(port); err != nil {
		log.Fatal().Err(err).Msg("Server stopped unexpectedly")
	}
}

// getEnvOrDefault retrieves environment variable or returns a default value
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
