package ports

import (
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"github.com/google/uuid"
)

type RefreshTokenRepository interface {
	Create(token *models.RefreshToken) error
	GetByHash(hash string) (*models.RefreshToken, error)
	GetByID(id uuid.UUID) (*models.RefreshToken, error)
	Update(token *models.RefreshToken) error
	Revoke(tokenID uuid.UUID) error
	RevokeAllForUser(userID uuid.UUID) error
}
