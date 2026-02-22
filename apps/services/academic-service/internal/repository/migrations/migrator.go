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
		&domain.Degree{},
		&domain.Specialization{},
		&domain.Batch{},
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

	// Add unique constraint for (department_id, code) on degrees
	if err := m.db.Exec(`
		CREATE UNIQUE INDEX IF NOT EXISTS idx_degrees_department_code
		ON degrees(department_id, code)
		WHERE deleted_at IS NULL
	`).Error; err != nil {
		m.logger.Warn("failed to create unique index on degrees", zap.Error(err))
	}

	// Add unique constraint for (degree_id, code) on specializations
	if err := m.db.Exec(`
		CREATE UNIQUE INDEX IF NOT EXISTS idx_specializations_degree_code
		ON specializations(degree_id, code)
		WHERE deleted_at IS NULL
	`).Error; err != nil {
		m.logger.Warn("failed to create unique index on specializations", zap.Error(err))
	}

	// Add unique constraint for (degree_id, code) on batches (partial — exclude soft-deleted)
	if err := m.db.Exec(`
		CREATE UNIQUE INDEX IF NOT EXISTS idx_batches_degree_code
		ON batches(degree_id, code)
		WHERE deleted_at IS NULL
	`).Error; err != nil {
		m.logger.Warn("failed to create unique index on batches", zap.Error(err))
	}

	// Add index on parent_id for fast hierarchy traversal
	if err := m.db.Exec(`
		CREATE INDEX IF NOT EXISTS idx_batches_parent_id
		ON batches(parent_id)
		WHERE deleted_at IS NULL
	`).Error; err != nil {
		m.logger.Warn("failed to create index on batches(parent_id)", zap.Error(err))
	}

	// Add index on degree_id for fast degree-scoped lookups
	if err := m.db.Exec(`
		CREATE INDEX IF NOT EXISTS idx_batches_degree_id
		ON batches(degree_id)
		WHERE deleted_at IS NULL
	`).Error; err != nil {
		m.logger.Warn("failed to create index on batches(degree_id)", zap.Error(err))
	}

	m.logger.Info("migrations completed successfully")
	return nil
}
