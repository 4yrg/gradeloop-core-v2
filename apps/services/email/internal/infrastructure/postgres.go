package infrastructure

import (
	"fmt"
	"log"

	"github.com/4yrg/gradeloop-core-v2/apps/services/email/internal/config"
	"github.com/4yrg/gradeloop-core-v2/apps/services/email/internal/domain"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func NewPostgresDB(cfg *config.Config) *gorm.DB {
	if err := ensureDatabaseExists(cfg); err != nil {
		log.Fatalf("Failed to ensure database exists: %v", err)
	}

	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.DB.Host, cfg.DB.Port, cfg.DB.User, cfg.DB.Password, cfg.DB.Name, cfg.DB.SSLMode,
	)

	logMode := logger.Warn
	if cfg.App.Env == "development" {
		logMode = logger.Info
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logMode),
	})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	log.Println("Connected to database successfully")

	// Auto Migration
	err = db.AutoMigrate(
		&domain.EmailTemplate{},
		&domain.EmailMessage{},
		&domain.EmailRecipient{},
		&domain.EmailAttachment{},
		&domain.EmailLog{},
	)
	if err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	return db
}

func ensureDatabaseExists(cfg *config.Config) error {
	adminDSN := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=postgres sslmode=%s",
		cfg.DB.Host, cfg.DB.Port, cfg.DB.User, cfg.DB.Password, cfg.DB.SSLMode,
	)

	db, err := gorm.Open(postgres.Open(adminDSN), &gorm.Config{})
	if err != nil {
		return fmt.Errorf("connecting to admin db: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("getting admin sql db: %w", err)
	}
	defer sqlDB.Close()

	var count int64
	err = db.Raw("SELECT count(*) FROM pg_database WHERE datname = ?", cfg.DB.Name).Scan(&count).Error
	if err != nil {
		return fmt.Errorf("checking if database exists: %w", err)
	}

	if count == 0 {
		log.Printf("database does not exist, creating it: %s", cfg.DB.Name)
		err = db.Exec(fmt.Sprintf(`CREATE DATABASE "%s"`, cfg.DB.Name)).Error
		if err != nil {
			return fmt.Errorf("creating database: %w", err)
		}
		log.Println("database created successfully")
	}

	return nil
}
