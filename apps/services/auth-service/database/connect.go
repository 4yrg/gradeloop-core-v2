package database

import (
	"fmt"
	"strconv"

	"github.com/4yrg/gradeloop-core-v2/apps/services/auth-service/config"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// ConnectDB connect to db
// Now supports configurable DB_HOST and DB_PORT with sensible defaults.
// Provides clearer warnings and error messages.
func ConnectDB() {
	var err error

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

	port, err := strconv.ParseUint(p, 10, 32)
	if err != nil {
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

	dsn := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=disable",
		host,
		port,
		user,
		pass,
		name,
	)

	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		// Include the underlying error to make troubleshooting easier
		panic(fmt.Sprintf("failed to connect database: %v", err))
	}

	fmt.Println("Connection Opened to Database")
	fmt.Println("Database Migrated")
}
