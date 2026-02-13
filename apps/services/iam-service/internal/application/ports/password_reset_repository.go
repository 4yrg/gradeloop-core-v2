package ports

import (
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"github.com/google/uuid"
)

type PasswordResetRepository interface {
	Create(token *models.PasswordResetToken) error
	FindByHash(hash string) (*models.PasswordResetToken, error)
	DeleteByID(id uuid.UUID) error
	DeleteExpired() error
}
