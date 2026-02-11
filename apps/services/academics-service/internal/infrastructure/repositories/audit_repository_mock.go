package repositories

import (
	"context"
	"log/slog"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
)

// MockAuditRepository is a no-op implementation for development.
type MockAuditRepository struct{}

func NewMockAuditRepository() *MockAuditRepository {
	return &MockAuditRepository{}
}

func (r *MockAuditRepository) CreateAuditLog(ctx context.Context, log *models.AuditLog) error {
	slog.Info("AUDIT_LOG [MOCK]", "action", log.Action, "entity", log.Entity, "entity_id", log.EntityID)
	return nil
}
