package migrations

import (
	"fmt"

	"github.com/gradeloop/academic-service/internal/domain"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type Migrator struct {
	db     *gorm.DB
	logger *zap.Logger
}

func NewMigrator(db *gorm.DB, logger *zap.Logger) *Migrator {
	return &Migrator{
		db:     db,
		logger: logger,
	}
}

func (m *Migrator) Run() error {
	m.logger.Info("running database migrations...")

	if err := m.db.AutoMigrate(
		&domain.Course{},
		&domain.Program{},
		&domain.Semester{},
		&domain.Enrollment{},
		&domain.Faculty{},
		&domain.FacultyLeadership{},
		&domain.Department{},
	); err != nil {
		return fmt.Errorf("auto migrate: %w", err)
	}

	// Add unique constraint for (faculty_id, code)
	if err := m.db.Exec(`
		CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_faculty_code
		ON departments(faculty_id, code)
		WHERE deleted_at IS NULL
	`).Error; err != nil {
		m.logger.Warn("failed to create unique index on departments", zap.Error(err))
	}

	m.logger.Info("migrations completed successfully")
	return nil
}
