package ports

import (
	"context"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
)

type AuditRepository interface {
	CreateAuditLog(ctx context.Context, log *models.AuditLog) error
}
