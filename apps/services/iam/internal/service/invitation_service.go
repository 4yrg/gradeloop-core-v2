package service

import (
	"context"
	"errors"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/domain"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/repository"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrInvitationNotFound   = errors.New("invitation not found")
	ErrInvitationExpired    = errors.New("invitation expired")
	ErrInvitationCancelled = errors.New("invitation cancelled")
	ErrInvitationUsed     = errors.New("invitation already used")
	ErrInvalidCode        = errors.New("invalid invitation code")
)

type InvitationService interface {
	Create(ctx context.Context, tenantID uuid.UUID, email, role, fullName, department, batch string, invitedBy uuid.UUID) (*domain.Invitation, error)
	GetByID(ctx context.Context, id uuid.UUID) (*domain.Invitation, error)
	GetByCode(ctx context.Context, code string) (*domain.Invitation, error)
	List(ctx context.Context, tenantID uuid.UUID, page, limit int, status string) ([]*domain.Invitation, int64, error)
	Resend(ctx context.Context, id uuid.UUID) (*domain.Invitation, error)
	Cancel(ctx context.Context, id uuid.UUID) error
	Accept(ctx context.Context, code string) (*domain.Invitation, error)
}

type invitationService struct {
	*BaseService
	repo repository.InvitationRepository
}

// NewInvitationService creates a new invitation service
func NewInvitationService(db *gorm.DB, repo repository.InvitationRepository) InvitationService {
	return &invitationService{
		BaseService: NewBaseService(db),
		repo:      repo,
	}
}

func (s *invitationService) Create(
	ctx context.Context,
	tenantID uuid.UUID,
	email, role, fullName, department, batch string,
	invitedBy uuid.UUID,
) (*domain.Invitation, error) {
	invitation := &domain.Invitation{
		TenantID:    tenantID,
		Email:      email,
		Role:       role,
		FullName:   fullName,
		Department: department,
		Batch:     batch,
		InvitedBy:  invitedBy,
		Status:    domain.InvitationStatusPending,
		ExpiresAt: time.Now().Add(7 * 24 * time.Hour), // 7 days expiry
	}

	// Check for existing pending invitation
	existing, err := s.repo.GetByEmail(ctx, tenantID, email)
	if err == nil && len(existing) > 0 {
		// Return existing if not expired
		return existing[0], nil
	}

	if err := s.repo.Create(ctx, invitation); err != nil {
		return nil, err
	}

	return invitation, nil
}

func (s *invitationService) GetByID(ctx context.Context, id uuid.UUID) (*domain.Invitation, error) {
	invitation, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, ErrInvitationNotFound
	}
	return invitation, nil
}

func (s *invitationService) GetByCode(ctx context.Context, code string) (*domain.Invitation, error) {
	invitation, err := s.repo.GetByCode(ctx, code)
	if err != nil {
		return nil, ErrInvalidCode
	}
	return invitation, nil
}

func (s *invitationService) List(ctx context.Context, tenantID uuid.UUID, page, limit int, status string) ([]*domain.Invitation, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	return s.repo.List(ctx, tenantID, page, limit, status)
}

func (s *invitationService) Resend(ctx context.Context, id uuid.UUID) (*domain.Invitation, error) {
	invitation, err := s.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if invitation.Status != domain.InvitationStatusPending {
		return nil, ErrInvitationNotFound
	}

	// Reset expiry
	invitation.ExpiresAt = time.Now().Add(7 * 24 * time.Hour)
	if err := s.repo.Update(ctx, invitation); err != nil {
		return nil, err
	}

	return invitation, nil
}

func (s *invitationService) Cancel(ctx context.Context, id uuid.UUID) error {
	invitation, err := s.GetByID(ctx, id)
	if err != nil {
		return err
	}

	if invitation.Status != domain.InvitationStatusPending {
		return ErrInvitationCancelled
	}

	return s.repo.MarkCancelled(ctx, id)
}

func (s *invitationService) Accept(ctx context.Context, code string) (*domain.Invitation, error) {
	invitation, err := s.GetByCode(ctx, code)
	if err != nil {
		return nil, ErrInvalidCode
	}

	if invitation.Status != domain.InvitationStatusPending {
		if invitation.Status == domain.InvitationStatusUsed {
			return nil, ErrInvitationUsed
		}
		return nil, ErrInvitationExpired
	}

	if invitation.IsExpired() {
		return nil, ErrInvitationExpired
	}

	if err := s.repo.MarkUsed(ctx, invitation.ID); err != nil {
		return nil, err
	}

	return invitation, nil
}