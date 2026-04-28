package repository

import (
	"context"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/notification/internal/domain"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type NotificationRepository struct {
	DB *gorm.DB
}

func NewNotificationRepository(db *gorm.DB) *NotificationRepository {
	return &NotificationRepository{DB: db}
}

func (r *NotificationRepository) Create(ctx context.Context, notification *domain.Notification) error {
	return r.DB.WithContext(ctx).Create(notification).Error
}

func (r *NotificationRepository) CreateBatch(ctx context.Context, notifications []domain.Notification) error {
	return r.DB.WithContext(ctx).CreateInBatches(notifications, 100).Error
}

func (r *NotificationRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.Notification, error) {
	var n domain.Notification
	if err := r.DB.WithContext(ctx).Where("id = ?", id).First(&n).Error; err != nil {
		return nil, err
	}
	return &n, nil
}

func (r *NotificationRepository) ListByUserID(ctx context.Context, userID uuid.UUID, read *bool, page, perPage int) ([]domain.Notification, int64, error) {
	var notifications []domain.Notification
	var total int64

	query := r.DB.WithContext(ctx).Where("user_id = ?", userID)
	if read != nil {
		query = query.Where("read = ?", *read)
	}

	if err := query.Model(&domain.Notification{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * perPage
	if err := query.Order("created_at DESC").Offset(offset).Limit(perPage).Find(&notifications).Error; err != nil {
		return nil, 0, err
	}

	return notifications, total, nil
}

func (r *NotificationRepository) CountUnreadByUserID(ctx context.Context, userID uuid.UUID) (int64, error) {
	var count int64
	if err := r.DB.WithContext(ctx).Model(&domain.Notification{}).Where("user_id = ? AND read = false", userID).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

func (r *NotificationRepository) MarkAsRead(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	now := time.Now().UTC()
	return r.DB.WithContext(ctx).Model(&domain.Notification{}).
		Where("id = ? AND user_id = ?", id, userID).
		Updates(map[string]any{"read": true, "read_at": now}).Error
}

func (r *NotificationRepository) MarkAllAsRead(ctx context.Context, userID uuid.UUID) error {
	now := time.Now().UTC()
	return r.DB.WithContext(ctx).Model(&domain.Notification{}).
		Where("user_id = ? AND read = false", userID).
		Updates(map[string]any{"read": true, "read_at": now}).Error
}

func (r *NotificationRepository) Delete(ctx context.Context, id uuid.UUID, userID uuid.UUID) error {
	return r.DB.WithContext(ctx).Where("id = ? AND user_id = ?", id, userID).Delete(&domain.Notification{}).Error
}
