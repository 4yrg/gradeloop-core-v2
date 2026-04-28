package service

import (
	"context"
	"errors"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/config"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/domain"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/repository"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrSSODisabled     = errors.New("SSO is disabled")
	ErrInvalidIdentity = errors.New("invalid SSO identity")
	ErrTenantRequired  = errors.New("tenant is required in production")
)

// JITService handles Just-in-Time user provisioning
type JITService struct {
	userRepo   repository.UserRepository
	tenantRepo repository.TenantRepository
	ssoConfig  *config.SSOConfig
}

// NewJITService creates a new JIT provisioning service
func NewJITService(
	userRepo repository.UserRepository,
	tenantRepo repository.TenantRepository,
	ssoConfig *config.SSOConfig,
) *JITService {
	return &JITService{
		userRepo:   userRepo,
		tenantRepo: tenantRepo,
		ssoConfig:  ssoConfig,
	}
}

// Provision creates or updates user from SSO identity
func (s *JITService) Provision(ctx context.Context, identity *domain.SSOIdentity) (*domain.User, error) {
	// Validate SSO is enabled
	if s.ssoConfig.IsDisabled() {
		return nil, ErrSSODisabled
	}

	// Validate identity
	if !identity.IsValid() {
		return nil, ErrInvalidIdentity
	}

	// Check if user exists by email
	user, err := s.userRepo.GetUserByEmail(ctx, identity.Email)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	// If user doesn't exist, create new
	if errors.Is(err, gorm.ErrRecordNotFound) {
		if !s.ssoConfig.JITEnabled {
			return nil, errors.New("JIT provisioning is disabled")
		}

		user = identity.ToUser()
		user.ID = uuid.New()

		// Set default role
		if user.UserType == "" {
			user.UserType = s.ssoConfig.DefaultRole
		}

		// Create user
		if err := s.userRepo.CreateUser(ctx, user); err != nil {
			return nil, err
		}
	}

	// Update existing user with SSO info
	if user.KeycloakID == "" {
		// First SSO login - update with SSO info
		user.KeycloakID = identity.ProviderID
	}

	// Update profile from SSO if changed
	if identity.Name != "" {
		user.FullName = identity.Name
	}
	if identity.AvatarURL != "" {
		user.AvatarURL = identity.AvatarURL
	}

	// Save updates
	if err := s.userRepo.UpdateUser(ctx, user); err != nil {
		return nil, err
	}

	return user, nil
}

// GetOrCreateUser gets existing user or creates new one
func (s *JITService) GetOrCreateUser(ctx context.Context, identity *domain.SSOIdentity) (*domain.User, error) {
	return s.Provision(ctx, identity)
}
