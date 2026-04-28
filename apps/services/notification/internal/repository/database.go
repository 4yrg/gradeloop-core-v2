package repository

import (
	"fmt"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/notification/internal/config"
	"go.uber.org/zap"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type Database struct {
	DB *gorm.DB
}

func NewPostgresDatabase(cfg *config.Config, log *zap.Logger) (*Database, error) {
	if err := ensureDatabaseExists(cfg, log); err != nil {
		return nil, fmt.Errorf("ensuring database exists: %w", err)
	}

	dsn := cfg.DSN()

	gormLogger := logger.New(
		&gormLoggerWrapper{log: log},
		logger.Config{
			SlowThreshold:             200 * time.Millisecond,
			LogLevel:                  logger.Warn,
			IgnoreRecordNotFoundError: true,
			Colorful:                  false,
		},
	)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger:                 gormLogger,
		SkipDefaultTransaction: true,
		PrepareStmt:            true,
	})
	if err != nil {
		return nil, fmt.Errorf("connecting to postgres: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("getting underlying sql.DB: %w", err)
	}

	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(5 * time.Minute)

	const (
		maxAttempts = 12
		retryDelay  = 5 * time.Second
	)
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		if pingErr := sqlDB.Ping(); pingErr == nil {
			break
		} else if attempt == maxAttempts {
			return nil, fmt.Errorf("database not reachable after %d attempts: %w", maxAttempts, pingErr)
		} else {
			log.Warn("database ping failed, retrying...",
				zap.Int("attempt", attempt),
				zap.Int("maxAttempts", maxAttempts),
				zap.Error(pingErr),
			)
			time.Sleep(retryDelay)
		}
	}

	return &Database{DB: db}, nil
}

func (d *Database) Close() error {
	sqlDB, err := d.DB.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

type gormLoggerWrapper struct {
	log *zap.Logger
}

func (g *gormLoggerWrapper) Printf(message string, args ...interface{}) {
	g.log.Sugar().Infof(message, args...)
}

func ensureDatabaseExists(cfg *config.Config, log *zap.Logger) error {
	adminDSN := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=postgres sslmode=%s",
		cfg.Database.Host,
		cfg.Database.Port,
		cfg.Database.User,
		cfg.Database.Password,
		cfg.Database.SSLMode,
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
	err = db.Raw("SELECT count(*) FROM pg_database WHERE datname = ?", cfg.Database.Name).Scan(&count).Error
	if err != nil {
		return fmt.Errorf("checking if database exists: %w", err)
	}

	if count == 0 {
		log.Info("database does not exist, creating it", zap.String("dbName", cfg.Database.Name))
		err = db.Exec(fmt.Sprintf(`CREATE DATABASE "%s"`, cfg.Database.Name)).Error
		if err != nil {
			return fmt.Errorf("creating database: %w", err)
		}
		log.Info("database created successfully")
	}

	return nil
}
