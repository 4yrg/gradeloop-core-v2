package repositories

import (
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type RefreshTokenRepository struct {
	db *gorm.DB
}

func NewRefreshTokenRepository(db *gorm.DB) *RefreshTokenRepository {
	return &RefreshTokenRepository{db: db}
}

func (r *RefreshTokenRepository) Create(token *models.RefreshToken) error {
	return r.db.Create(token).Error
}

func (r *RefreshTokenRepository) GetByHash(hash string) (*models.RefreshToken, error) {
	var token models.RefreshToken
	err := r.db.Where("token_hash = ?", hash).First(&token).Error
	if err != nil {
		return nil, err
	}
	return &token, nil
}

func (r *RefreshTokenRepository) GetByID(id uuid.UUID) (*models.RefreshToken, error) {
	var token models.RefreshToken
	err := r.db.Where("token_id = ?", id).First(&token).Error
	if err != nil {
		return nil, err
	}
	return &token, nil
}

func (r *RefreshTokenRepository) Update(token *models.RefreshToken) error {
	return r.db.Save(token).Error
}

func (r *RefreshTokenRepository) Revoke(tokenID uuid.UUID) error {
	// Update is_revoked to true. Idempotent by design in SQL.
	return r.db.Model(&models.RefreshToken{}).Where("token_id = ?", tokenID).Update("is_revoked", true).Error
}

func (r *RefreshTokenRepository) RevokeAllForUser(userID uuid.UUID) error {
	// Bulk update to revoke all active sessions for a specific user.
	return r.db.Model(&models.RefreshToken{}).Where("user_id = ?", userID).Update("is_revoked", true).Error
}
