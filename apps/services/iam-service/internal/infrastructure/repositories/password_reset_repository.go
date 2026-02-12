package repositories

import (
	"context"
	"errors"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/application/ports"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type PasswordResetRepository struct {
	db *gorm.DB
}

func NewPasswordResetRepository(db *gorm.DB) ports.PasswordResetRepository {
	return &PasswordResetRepository{db: db}
}

func (r *PasswordResetRepository) Create(ctx context.Context, token *models.PasswordResetToken) error {
	return r.db.WithContext(ctx).Create(token).Error
}

func (r *PasswordResetRepository) GetByTokenHash(ctx context.Context, tokenHash string) (*models.PasswordResetToken, error) {
	var token models.PasswordResetToken
	err := r.db.WithContext(ctx).
		Where("token_hash = ?", tokenHash).
		First(&token).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("password reset token not found")
		}
		return nil, err
	}

	return &token, nil
}

func (r *PasswordResetRepository) GetByUserID(ctx context.Context, userID uuid.UUID) (*models.PasswordResetToken, error) {
	var token models.PasswordResetToken
	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		First(&token).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("no password reset token found for user")
		}
		return nil, err
	}

	return &token, nil
}

func (r *PasswordResetRepository) MarkAsUsed(ctx context.Context, tokenID uuid.UUID) error {
	now := time.Now()
	return r.db.WithContext(ctx).
		Model(&models.PasswordResetToken{}).
		Where("id = ?", tokenID).
		Updates(map[string]interface{}{
			"is_used": true,
			"used_at": now,
		}).Error
}

func (r *PasswordResetRepository) InvalidateAllForUser(ctx context.Context, userID uuid.UUID) error {
	now := time.Now()
	return r.db.WithContext(ctx).
		Model(&models.PasswordResetToken{}).
		Where("user_id = ? AND is_used = ? AND expires_at > ?", userID, false, now).
		Updates(map[string]interface{}{
			"is_used": true,
			"used_at": now,
		}).Error
}

func (r *PasswordResetRepository) CleanupExpired(ctx context.Context, before time.Time) error {
	return r.db.WithContext(ctx).
		Where("expires_at < ?", before).
		Delete(&models.PasswordResetToken{}).Error
}

func (r *PasswordResetRepository) CountActiveTokensForUser(ctx context.Context, userID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&models.PasswordResetToken{}).
		Where("user_id = ? AND is_used = ? AND expires_at > ?", userID, false, time.Now()).
		Count(&count).Error

	return count, err
}
