package repositories

import (
	"context"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/ports"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
	"github.com/4yrg/gradeloop-core-v2/shared/libs/go/logger"
	"gorm.io/gorm"
)

type GormAuditRepository struct {
	db *gorm.DB
}

func NewGormAuditRepository(db *gorm.DB) ports.AuditRepository {
	return &GormAuditRepository{db: db}
}

func (r *GormAuditRepository) CreateAuditLog(ctx context.Context, auditLog *models.AuditLog) error {
	if auditLog.TraceID == "" {
		auditLog.TraceID = logger.FromCtx(ctx)
	}
	return r.db.WithContext(ctx).Create(auditLog).Error
}
