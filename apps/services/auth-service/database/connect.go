package database

import (
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/auth-service/config"
	"github.com/4yrg/gradeloop-core-v2/apps/services/auth-service/model"

	"golang.org/x/crypto/bcrypt"
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

	// Auto-migrate models used by the auth service.
	// This ensures the necessary tables/columns exist when the service starts.
	if err := DB.AutoMigrate(&model.User{}, &model.RefreshToken{}, &model.PasswordReset{}); err != nil {
		// Include the underlying error to make troubleshooting easier
		panic(fmt.Sprintf("failed to migrate database: %v", err))
	}

	// Seed super admin if configured and not already present in the DB.
	// Provide SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD in the environment to enable seeding.
	superEmail := config.Config("SUPER_ADMIN_EMAIL")
	superPass := config.Config("SUPER_ADMIN_PASSWORD")
	if superEmail != "" && superPass != "" {
		var u model.User
		if err := DB.Where(&model.User{Email: superEmail}).First(&u).Error; errors.Is(err, gorm.ErrRecordNotFound) {
			// Hash password and create super admin
			hash, herr := bcrypt.GenerateFromPassword([]byte(superPass), 14)
			if herr != nil {
				fmt.Println("Warning: couldn't hash super admin password:", herr)
			} else {
				admin := model.User{
					Username: "superadmin",
					Email:    superEmail,
					Password: string(hash),
					UserType: model.SuperAdmin,
				}
				if cerr := DB.Create(&admin).Error; cerr != nil {
					fmt.Println("Warning: failed to create super admin:", cerr)
				} else {
					fmt.Println("Super admin seeded:", superEmail)
				}
			}
		} else if err != nil {
			fmt.Println("Warning checking super admin:", err)
		} else {
			fmt.Println("Super admin already exists:", superEmail)
		}
	} else {
		fmt.Println("SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD not set; skipping super admin seed")
	}

	fmt.Println("Database Migrated")
}
