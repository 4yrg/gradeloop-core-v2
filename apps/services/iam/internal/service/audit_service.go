package service

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/domain"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrAuditNotFound = errors.New("audit log not found")
)

type AuditService interface {
	Log(ctx context.Context, userID uuid.UUID, action, description string, entityType, entityID string, metadata map[string]interface{}, ipAddress, userAgent string) error
	GetByUser(ctx context.Context, userID uuid.UUID, page, limit int) ([]*domain.ActivityLog, int64, error)
	GetByTenant(ctx context.Context, tenantID uuid.UUID, page, limit int, action string) ([]*domain.ActivityLog, int64, error)
	GetGlobal(ctx context.Context, page, limit int, action, userID string) ([]*domain.ActivityLog, int64, error)
}

type auditService struct {
	db *gorm.DB
}

// NewAuditService creates a new audit service
func NewAuditService(db *gorm.DB) AuditService {
	return &auditService{db: db}
}

func (s *auditService) Log(
	ctx context.Context,
	userID uuid.UUID,
	action, description string,
	entityType, entityID string,
	metadata map[string]interface{},
	ipAddress, userAgent string,
) error {
	metadataJSON, _ := json.Marshal(metadata)

	activityLog := &domain.ActivityLog{
		ID:          uuid.New(),
		UserID:      userID,
		Action:      action,
		Description: description,
		EntityType:  entityType,
		EntityID:    entityID,
		Metadata:    string(metadataJSON),
		IPAddress:   ipAddress,
		UserAgent:   userAgent,
		CreatedAt:   time.Now(),
	}

	return s.db.WithContext(ctx).Create(activityLog).Error
}

func (s *auditService) GetByUser(ctx context.Context, userID uuid.UUID, page, limit int) ([]*domain.ActivityLog, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}

	var logs []*domain.ActivityLog
	var total int64

	query := s.db.WithContext(ctx).Model(&domain.ActivityLog{}).Where("user_id = ?", userID)
	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	err = query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&logs).Error
	return logs, total, err
}

func (s *auditService) GetByTenant(ctx context.Context, tenantID uuid.UUID, page, limit int, action string) ([]*domain.ActivityLog, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}

	var logs []*domain.ActivityLog
	var total int64

	query := s.db.WithContext(ctx).Model(&domain.ActivityLog{})
	if action != "" {
		query = query.Where("action = ?", action)
	}
	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	err = query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&logs).Error
	return logs, total, err
}

func (s *auditService) GetGlobal(ctx context.Context, page, limit int, action, userID string) ([]*domain.ActivityLog, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}

	var logs []*domain.ActivityLog
	var total int64

	query := s.db.WithContext(ctx).Model(&domain.ActivityLog{})
	if action != "" {
		query = query.Where("action = ?", action)
	}
	if userID != "" {
		query = query.Where("user_id = ?", userID)
	}

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	err = query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&logs).Error
	return logs, total, err
}
