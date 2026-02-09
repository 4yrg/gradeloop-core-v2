package repositories

import (
	"context"

	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"gorm.io/gorm"
)

type AuditRepository struct {
	db *gorm.DB
}

func NewAuditRepository(db *gorm.DB) *AuditRepository {
	return &AuditRepository{db: db}
}

func (r *AuditRepository) CreateAuditLog(ctx context.Context, auditLog *models.AuditLog) error {
	return r.db.WithContext(ctx).Create(auditLog).Error
}
