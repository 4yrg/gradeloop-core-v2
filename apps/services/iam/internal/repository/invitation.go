package repository

import (
	"context"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/domain"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// InvitationRepository defines operations for invitation data
type InvitationRepository interface {
	Create(ctx context.Context, invitation *domain.Invitation) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.Invitation, error)
	GetByCode(ctx context.Context, code string) (*domain.Invitation, error)
	GetByEmail(ctx context.Context, tenantID uuid.UUID, email string) ([]*domain.Invitation, error)
	List(ctx context.Context, tenantID uuid.UUID, page, limit int, status string) ([]*domain.Invitation, int64, error)
	Update(ctx context.Context, invitation *domain.Invitation) error
	MarkUsed(ctx context.Context, id uuid.UUID) error
	MarkCancelled(ctx context.Context, id uuid.UUID) error
	Delete(ctx context.Context, id uuid.UUID) error
}

type invitationRepository struct {
	db *gorm.DB
}

// NewInvitationRepository creates a new invitation repository
func NewInvitationRepository(db *gorm.DB) InvitationRepository {
	return &invitationRepository{db: db}
}

func (r *invitationRepository) Create(ctx context.Context, invitation *domain.Invitation) error {
	invitation.ID = uuid.New()
	invitation.InvitationCode = generateInvitationCode()
	invitation.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(invitation).Error
}

func (r *invitationRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.Invitation, error) {
	var invitation domain.Invitation
	err := r.db.WithContext(ctx).
		Where("id = ?", id).
		First(&invitation).Error
	return &invitation, err
}

func (r *invitationRepository) GetByCode(ctx context.Context, code string) (*domain.Invitation, error) {
	var invitation domain.Invitation
	err := r.db.WithContext(ctx).
		Where("invitation_code = ?", code).
		First(&invitation).Error
	return &invitation, err
}

func (r *invitationRepository) GetByEmail(ctx context.Context, tenantID uuid.UUID, email string) ([]*domain.Invitation, error) {
	var invitations []*domain.Invitation
	err := r.db.WithContext(ctx).
		Where("tenant_id = ? AND email = ? AND status = ?", tenantID, email, domain.InvitationStatusPending).
		Order("created_at DESC").
		Find(&invitations).Error
	return invitations, err
}

func (r *invitationRepository) List(ctx context.Context, tenantID uuid.UUID, page, limit int, status string) ([]*domain.Invitation, int64, error) {
	var invitations []*domain.Invitation
	var total int64

	query := r.db.WithContext(ctx).Model(&domain.Invitation{}).Where("tenant_id = ?", tenantID)
	if status != "" {
		query = query.Where("status = ?", status)
	}

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * limit
	err = query.Offset(offset).Limit(limit).Order("created_at DESC").Find(&invitations).Error
	return invitations, total, err
}

func (r *invitationRepository) Update(ctx context.Context, invitation *domain.Invitation) error {
	return r.db.WithContext(ctx).Save(invitation).Error
}

func (r *invitationRepository) MarkUsed(ctx context.Context, id uuid.UUID) error {
	now := time.Now()
	return r.db.WithContext(ctx).
		Model(&domain.Invitation{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"status":      domain.InvitationStatusUsed,
			"accepted_at": now,
		}).Error
}

func (r *invitationRepository) MarkCancelled(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).
		Model(&domain.Invitation{}).
		Where("id = ?", id).
		Update("status", domain.InvitationStatusCancelled).Error
}

func (r *invitationRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).
		Where("id = ?", id).
		Delete(&domain.Invitation{}).Error
}

func generateInvitationCode() string {
	return uuid.New().String()[:8]
}
