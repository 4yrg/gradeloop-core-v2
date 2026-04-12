package repository

import (
	"fmt"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academic/internal/config"
	"go.uber.org/zap"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type Database struct {
	DB *gorm.DB
}

func NewPostgresDatabase(cfg *config.Config, log *zap.Logger) (*Database, error) {
	dsn := cfg.DSN()

	gormLogger := logger.New(
		&gormLoggerWrapper{log: log},
		logger.Config{
			SlowThreshold:             0,
			LogLevel:                  logger.Warn,
			IgnoreRecordNotFoundError: true,
			Colorful:                  true,
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

	sqlDB.SetMaxIdleConns(25)
	sqlDB.SetMaxOpenConns(200)
	sqlDB.SetConnMaxLifetime(5 * time.Minute)

	// Verify the connection is usable before returning. Aiven cloud DBs can be
	// slow to accept new connections on cold start; retry for up to 60 s.
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
	g.log.Info(fmt.Sprintf(message, args...))
}
