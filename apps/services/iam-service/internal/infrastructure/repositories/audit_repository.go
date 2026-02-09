package repositories

import (
	"context"

	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"github.com/4YRG/gradeloop-core-v2/shared/libs/go/logger"
	"gorm.io/gorm"
)

type AuditRepository struct {
	db *gorm.DB
}

func NewAuditRepository(db *gorm.DB) *AuditRepository {
	return &AuditRepository{db: db}
}

func (r *AuditRepository) CreateAuditLog(ctx context.Context, auditLog *models.AuditLog) error {
	// Automatically inject trace ID from context for audit correlation
	if auditLog.TraceID == "" {
		auditLog.TraceID = logger.FromCtx(ctx)
	}
	return r.db.WithContext(ctx).Create(auditLog).Error
}
