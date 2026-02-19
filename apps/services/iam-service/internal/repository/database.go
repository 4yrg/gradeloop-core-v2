package repository

import (
	"fmt"

	"github.com/gradeloop/iam-service/internal/config"
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
			LogLevel:                  logger.Info,
			IgnoreRecordNotFoundError: true,
			Colorful:                  true,
		},
	)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: gormLogger,
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
