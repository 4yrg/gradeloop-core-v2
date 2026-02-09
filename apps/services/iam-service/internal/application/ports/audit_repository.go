package ports

import (
	"context"

	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
)

type AuditRepository interface {
	CreateAuditLog(ctx context.Context, log *models.AuditLog) error
}
