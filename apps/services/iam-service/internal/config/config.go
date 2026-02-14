package config

import (
	"fmt"
	"net/url"
	"os"
	"time"

	"github.com/rs/zerolog/log"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Config holds the application configuration
type Config struct {
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string
	JWTSecret  string
}

// LoadConfig loads configuration from environment variables
func LoadConfig() *Config {
	// Check if DATABASE_URL is provided (Aiven connection)
	if dbURL := os.Getenv("DATABASE_URL"); dbURL != "" {
		log.Info().Str("DATABASE_URL", dbURL).Msg("Using DATABASE_URL for configuration")
		return loadConfigFromURL(dbURL)
	}
	
	log.Info().Msg("DATABASE_URL not found, using individual environment variables")
	// Fallback to individual environment variables
	return &Config{
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "5432"),
		DBUser:     getEnv("DB_USER", "postgres"),
		DBPassword: getEnv("DB_PASSWORD", "postgres"),
		DBName:     getEnv("DB_NAME", "iam_db"),
		DBSSLMode:  getEnv("DB_SSLMODE", "require"),
		JWTSecret:  getEnv("JWT_SECRET", "default_secret_for_development"),
	}
}

// loadConfigFromURL parses a PostgreSQL connection URL and extracts configuration
func loadConfigFromURL(dbURL string) *Config {
	u, err := url.Parse(dbURL)
	if err != nil {
		log.Error().Err(err).Str("url", dbURL).Msg("Failed to parse DATABASE_URL")
		// Fall back to default configuration
		return &Config{
			DBHost:     "localhost",
			DBPort:     "5432",
			DBUser:     "postgres",
			DBPassword: "postgres",
			DBName:     "iam_db",
			DBSSLMode:  "require",
			JWTSecret:  "default_secret_for_development",
		}
	}

	// Extract database name from path
	dbName := "iam_db" // default
	if u.Path != "" && len(u.Path) > 1 {
		dbName = u.Path[1:] // Remove leading slash
	}

	// Extract SSL mode from query parameters
	sslMode := "require"
	queryParams := u.Query()
	if sslParam := queryParams.Get("sslmode"); sslParam != "" {
		sslMode = sslParam
	}

	log.Info().
		Str("host", u.Hostname()).
		Str("port", u.Port()).
		Str("user", u.User.Username()).
		Str("dbName", dbName).
		Str("sslMode", sslMode).
		Msg("Parsed database configuration from URL")

	return &Config{
		DBHost:     u.Hostname(),
		DBPort:     u.Port(),
		DBUser:     u.User.Username(),
		DBPassword: getPassword(u),
		DBName:     dbName,
		DBSSLMode:  sslMode,
		JWTSecret:  getEnv("JWT_SECRET", "default_secret_for_development"),
	}
}

// getPassword extracts password from URL user info
func getPassword(u *url.URL) string {
	password, _ := u.User.Password()
	return password
}

// getEnv retrieves environment variable or returns a default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// ConnectDB establishes a connection to the PostgreSQL database
func ConnectDB(config *Config) (*gorm.DB, error) {
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=%s TimeZone=UTC",
		config.DBHost, config.DBUser, config.DBPassword, config.DBName, config.DBPort, config.DBSSLMode)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		log.Error().Err(err).Msg("Failed to connect to database")
		return nil, err
	}

	// Configure connection pool
	sqlDB, err := db.DB()
	if err != nil {
		log.Error().Err(err).Msg("Failed to get database instance")
		return nil, err
	}

	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	log.Info().Msg("Successfully connected to database")

	return db, nil
}
