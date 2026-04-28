package migrations

import (
	"github.com/4yrg/gradeloop-core-v2/apps/services/notification/internal/domain"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type Migrator struct {
	db     *gorm.DB
	logger *zap.Logger
}

func NewMigrator(db *gorm.DB, logger *zap.Logger) *Migrator {
	return &Migrator{db: db, logger: logger}
}

func (m *Migrator) Run() error {
	m.logger.Info("running database migrations...")

	if err := m.db.AutoMigrate(&domain.Notification{}); err != nil {
		return err
	}

	if err := m.db.Exec("CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created ON notifications (user_id, read, created_at DESC)").Error; err != nil {
		return err
	}

	if err := m.db.Exec("CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications (user_id, created_at DESC)").Error; err != nil {
		return err
	}

	m.logger.Info("database migrations completed")
	return nil
}
