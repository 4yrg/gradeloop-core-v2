package repository

import (
	"context"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/domain"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// SessionRepository defines operations for session data
type SessionRepository interface {
	Create(ctx context.Context, session *domain.Session) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.Session, error)
	GetByToken(ctx context.Context, tokenID string) (*domain.Session, error)
	GetByUser(ctx context.Context, userID uuid.UUID) ([]*domain.Session, error)
	Update(ctx context.Context, session *domain.Session) error
	Revoke(ctx context.Context, id uuid.UUID) error
	RevokeByUser(ctx context.Context, userID uuid.UUID) error
	RevokeExpired(ctx context.Context) error
}

type sessionRepository struct {
	db *gorm.DB
}

// NewSessionRepository creates a new session repository
func NewSessionRepository(db *gorm.DB) SessionRepository {
	return &sessionRepository{db: db}
}

func (r *sessionRepository) Create(ctx context.Context, session *domain.Session) error {
	session.ID = uuid.New()
	return r.db.WithContext(ctx).Create(session).Error
}

func (r *sessionRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.Session, error) {
	var session domain.Session
	err := r.db.WithContext(ctx).
		Where("id = ?", id).
		First(&session).Error
	return &session, err
}

func (r *sessionRepository) GetByToken(ctx context.Context, tokenID string) (*domain.Session, error) {
	var session domain.Session
	err := r.db.WithContext(ctx).
		Where("token_id = ? AND is_revoked = ? AND expires_at > ?", tokenID, false, time.Now()).
		First(&session).Error
	return &session, err
}

func (r *sessionRepository) GetByUser(ctx context.Context, userID uuid.UUID) ([]*domain.Session, error) {
	var sessions []*domain.Session
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND is_revoked = ? AND expires_at > ?", userID, false, time.Now()).
		Order("issued_at DESC").
		Find(&sessions).Error
	return sessions, err
}

func (r *sessionRepository) Update(ctx context.Context, session *domain.Session) error {
	return r.db.WithContext(ctx).Save(session).Error
}

func (r *sessionRepository) Revoke(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).
		Model(&domain.Session{}).
		Where("id = ?", id).
		Update("is_revoked", true).Error
}

func (r *sessionRepository) RevokeByUser(ctx context.Context, userID uuid.UUID) error {
	return r.db.WithContext(ctx).
		Model(&domain.Session{}).
		Where("user_id = ?", userID).
		Update("is_revoked", true).Error
}

func (r *sessionRepository) RevokeExpired(ctx context.Context) error {
	return r.db.WithContext(ctx).
		Model(&domain.Session{}).
		Where("expires_at < ?", time.Now()).
		Update("is_revoked", true).Error
}

// DeviceRepository defines operations for device registration
type DeviceRepository interface {
	Create(ctx context.Context, device *domain.DeviceRegistration) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.DeviceRegistration, error)
	GetByDeviceID(ctx context.Context, deviceID string, userID uuid.UUID) (*domain.DeviceRegistration, error)
	GetByUser(ctx context.Context, userID uuid.UUID) ([]*domain.DeviceRegistration, error)
	Update(ctx context.Context, device *domain.DeviceRegistration) error
	Revoke(ctx context.Context, id uuid.UUID) error
	Delete(ctx context.Context, id uuid.UUID) error
}

type deviceRepository struct {
	db *gorm.DB
}

// NewDeviceRepository creates a new device repository
func NewDeviceRepository(db *gorm.DB) DeviceRepository {
	return &deviceRepository{db: db}
}

func (r *deviceRepository) Create(ctx context.Context, device *domain.DeviceRegistration) error {
	device.ID = uuid.New()
	return r.db.WithContext(ctx).Create(device).Error
}

func (r *deviceRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.DeviceRegistration, error) {
	var device domain.DeviceRegistration
	err := r.db.WithContext(ctx).
		Where("id = ?", id).
		First(&device).Error
	return &device, err
}

func (r *deviceRepository) GetByDeviceID(ctx context.Context, deviceID string, userID uuid.UUID) (*domain.DeviceRegistration, error) {
	var device domain.DeviceRegistration
	err := r.db.WithContext(ctx).
		Where("device_id = ? AND user_id = ? AND revoked = ?", deviceID, userID, false).
		First(&device).Error
	return &device, err
}

func (r *deviceRepository) GetByUser(ctx context.Context, userID uuid.UUID) ([]*domain.DeviceRegistration, error) {
	var devices []*domain.DeviceRegistration
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND revoked = ?", userID, false).
		Order("created_at DESC").
		Find(&devices).Error
	return devices, err
}

func (r *deviceRepository) Update(ctx context.Context, device *domain.DeviceRegistration) error {
	return r.db.WithContext(ctx).Save(device).Error
}

func (r *deviceRepository) Revoke(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).
		Model(&domain.DeviceRegistration{}).
		Where("id = ?", id).
		Update("revoked", true).Error
}

func (r *deviceRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).
		Where("id = ?", id).
		Delete(&domain.DeviceRegistration{}).Error
}