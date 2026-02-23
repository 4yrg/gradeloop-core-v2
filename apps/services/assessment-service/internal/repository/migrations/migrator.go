package migrations

import (
	"fmt"

	"github.com/4yrg/gradeloop-core-v2/assessment-service/internal/domain"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// Migrator runs all database migrations for the assessment service.
type Migrator struct {
	db     *gorm.DB
	logger *zap.Logger
}

// NewMigrator creates a new Migrator.
func NewMigrator(db *gorm.DB, logger *zap.Logger) *Migrator {
	return &Migrator{
		db:     db,
		logger: logger,
	}
}

// Run executes all registered migrations in order.
func (m *Migrator) Run() error {
	m.logger.Info("running database migrations...")

	// AutoMigrate creates/updates all tables to match the domain models.
	if err := m.db.AutoMigrate(
		&domain.Assignment{},
		&domain.Submission{},
		&domain.SubmissionGroup{},
	); err != nil {
		return fmt.Errorf("auto migrate tables: %w", err)
	}

	// Index on course_instance_id for fast course-scoped lookups.
	if err := m.db.Exec(`
		CREATE INDEX IF NOT EXISTS idx_assignments_course_instance_id
		ON assignments(course_instance_id)
	`).Error; err != nil {
		m.logger.Warn("failed to create index on assignments(course_instance_id)", zap.Error(err))
	}

	// Partial index on is_active for fast active-assignment queries.
	if err := m.db.Exec(`
		CREATE INDEX IF NOT EXISTS idx_assignments_is_active
		ON assignments(is_active)
		WHERE is_active = true
	`).Error; err != nil {
		m.logger.Warn("failed to create index on assignments(is_active)", zap.Error(err))
	}

	// Index on created_by for auditing / user-scoped queries.
	if err := m.db.Exec(`
		CREATE INDEX IF NOT EXISTS idx_assignments_created_by
		ON assignments(created_by)
	`).Error; err != nil {
		m.logger.Warn("failed to create index on assignments(created_by)", zap.Error(err))
	}

	// Composite index to speed up listing active assignments for a course instance.
	if err := m.db.Exec(`
		CREATE INDEX IF NOT EXISTS idx_assignments_course_instance_active
		ON assignments(course_instance_id, is_active)
	`).Error; err != nil {
		m.logger.Warn("failed to create composite index on assignments(course_instance_id, is_active)", zap.Error(err))
	}

	// ── Submissions indexes ───────────────────────────────────────────────────

	// Composite index for fast per-user version history lookups.
	if err := m.db.Exec(`
		CREATE INDEX IF NOT EXISTS assignment_user_idx
		ON submissions(assignment_id, user_id)
	`).Error; err != nil {
		m.logger.Warn("failed to create index assignment_user_idx", zap.Error(err))
	}

	// Composite index for fast per-group version history lookups.
	if err := m.db.Exec(`
		CREATE INDEX IF NOT EXISTS assignment_group_idx
		ON submissions(assignment_id, group_id)
	`).Error; err != nil {
		m.logger.Warn("failed to create index assignment_group_idx", zap.Error(err))
	}

	// Partial index on is_latest for O(1) latest-submission lookups.
	if err := m.db.Exec(`
		CREATE INDEX IF NOT EXISTS latest_idx
		ON submissions(is_latest)
		WHERE is_latest = true
	`).Error; err != nil {
		m.logger.Warn("failed to create partial index latest_idx", zap.Error(err))
	}

	// GIN index on the members JSONB column for fast @> containment queries
	// used when checking group membership.
	if err := m.db.Exec(`
		CREATE INDEX IF NOT EXISTS idx_groups_members_gin
		ON groups USING GIN (members)
	`).Error; err != nil {
		m.logger.Warn("failed to create GIN index on groups.members", zap.Error(err))
	}

	// Index on groups.assignment_id for fast assignment-scoped group lookups.
	if err := m.db.Exec(`
		CREATE INDEX IF NOT EXISTS idx_groups_assignment_id
		ON groups(assignment_id)
	`).Error; err != nil {
		m.logger.Warn("failed to create index on groups(assignment_id)", zap.Error(err))
	}

	m.logger.Info("migrations completed successfully")
	return nil
}
