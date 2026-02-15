package database

import (
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/auth-service/config"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// ConnectDB connect to db
// Supports Aiven POSTGRES_URL_BASE + AUTH_SVC_DB_NAME. Falls back to DB_* env vars.
// Respects POSTGRES_SSLMODE when provided.
func ConnectDB() {
	var err error

	// Try using Aiven-style base URL first (POSTGRES_URL_BASE).
	aivenBase := config.Config("POSTGRES_URL_BASE")
	sslmode := config.Config("POSTGRES_SSLMODE")
	var dsn string

	if aivenBase != "" {
		// Prefer a service-specific DB name, fall back to DB_NAME.
		dbName := config.Config("AUTH_SVC_DB_NAME")
		if dbName == "" {
			dbName = config.Config("DB_NAME")
		}
		if dbName == "" {
			fmt.Println("Warning: AUTH_SVC_DB_NAME and DB_NAME are empty when using POSTGRES_URL_BASE")
		}

		u, perr := url.Parse(aivenBase)
		if perr == nil {
			// Replace path with the desired DB name if available.
			if dbName != "" {
				u.Path = "/" + strings.TrimPrefix(dbName, "/")
			}
			q := u.Query()
			if sslmode != "" {
				q.Set("sslmode", sslmode)
			}
			u.RawQuery = q.Encode()
			dsn = u.String()
		} else {
			fmt.Printf("Warning: unable to parse POSTGRES_URL_BASE %q: %v\n", aivenBase, perr)
		}
	}

	// If no Aiven DSN constructed, fall back to classic DB_* environment variables.
	if dsn == "" {
		// Allow overriding the host (defaults to the docker-compose service name)
		host := config.Config("DB_HOST")
		if host == "" {
			host = "db"
		}

		// Allow overriding the port; default to 5432 when missing or invalid.
		p := config.Config("DB_PORT")
		if p == "" {
			p = "5432"
		}

		port, perr := strconv.ParseUint(p, 10, 32)
		if perr != nil {
			// Provide a clear warning and fall back to 5432
			fmt.Printf("Warning: unable to parse DB_PORT %q - falling back to default port 5432\n", p)
			port = 5432
		}

		user := config.Config("DB_USER")
		pass := config.Config("DB_PASSWORD")
		name := config.Config("DB_NAME")

		if user == "" || pass == "" || name == "" {
			fmt.Println("Warning: one or more database credentials (DB_USER/DB_PASSWORD/DB_NAME) are empty")
		}

		// Default sslmode to disable to preserve previous behavior unless POSTGRES_SSLMODE is set.
		if sslmode == "" {
			sslmode = "disable"
		}

		dsn = fmt.Sprintf(
			"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
			host,
			port,
			user,
			pass,
			name,
			sslmode,
		)
	}

	// Attempt to connect with retries and exponential backoff.
	// This helps transient network/DNS issues when the DB host isn't yet resolvable.
	maxAttempts := 5
	delay := 2 * time.Second
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
		if err == nil {
			break
		}
		fmt.Printf("Database connection attempt %d/%d failed: %v\n", attempt, maxAttempts, err)
		if attempt < maxAttempts {
			time.Sleep(delay)
			// Exponential backoff for subsequent attempts.
			delay = delay * 2
		}
	}

	if err != nil {
		// Include the underlying error to make troubleshooting easier
		panic(fmt.Sprintf("failed to connect database after %d attempts: %v", maxAttempts, err))
	}

	fmt.Println("Connection Opened to Database")
	fmt.Println("Database Migrated")
}
