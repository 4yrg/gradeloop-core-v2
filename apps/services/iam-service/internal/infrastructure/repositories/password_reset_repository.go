package repositories

import (
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type PasswordResetRepository struct {
	db *gorm.DB
}

func NewPasswordResetRepository(db *gorm.DB) *PasswordResetRepository {
	return &PasswordResetRepository{db: db}
}

func (r *PasswordResetRepository) Create(token *models.PasswordResetToken) error {
	return r.db.Create(token).Error
}

func (r *PasswordResetRepository) FindByHash(hash string) (*models.PasswordResetToken, error) {
	var token models.PasswordResetToken
	err := r.db.Where("token_hash = ? AND expires_at > ?", hash, time.Now()).First(&token).Error
	if err != nil {
		return nil, err
	}
	return &token, nil
}

func (r *PasswordResetRepository) DeleteByID(id uuid.UUID) error {
	return r.db.Delete(&models.PasswordResetToken{}, id).Error
}

func (r *PasswordResetRepository) DeleteExpired() error {
	return r.db.Where("expires_at < ?", time.Now()).Delete(&models.PasswordResetToken{}).Error
}
