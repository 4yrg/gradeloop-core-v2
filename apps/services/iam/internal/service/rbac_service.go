package service

import (
	"context"
	"errors"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/domain"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/repository"
	"github.com/google/uuid"
)

var (
	ErrRoleNotFound       = errors.New("role not found")
	ErrRoleExists         = errors.New("role already exists")
	ErrPermissionNotFound = errors.New("permission not found")
)

type RBACService interface {
	// Roles
	CreateRole(ctx context.Context, tenantID uuid.UUID, name, description string) (*domain.Role, error)
	GetRole(ctx context.Context, id uuid.UUID) (*domain.Role, error)
	GetRoleByName(ctx context.Context, tenantID uuid.UUID, name string) (*domain.Role, error)
	ListRoles(ctx context.Context, tenantID uuid.UUID) ([]*domain.Role, error)
	UpdateRole(ctx context.Context, id uuid.UUID, name, description string) (*domain.Role, error)
	DeleteRole(ctx context.Context, id uuid.UUID) error

	// Permissions
	ListPermissions(ctx context.Context, category string) ([]*domain.Permission, error)

	// User Role Assignment
	AssignRole(ctx context.Context, userID, roleID, tenantID uuid.UUID, assignedBy uuid.UUID) error
	RemoveRole(ctx context.Context, userID, roleID uuid.UUID) error
	GetUserRoles(ctx context.Context, userID uuid.UUID) ([]*domain.Role, error)

	// Seed
	SeedDefaultData(ctx context.Context) error
}

type rbacService struct {
	repo repository.RBACRepository
}

// NewRBACService creates a new RBAC service
func NewRBACService(repo repository.RBACRepository) RBACService {
	return &rbacService{repo: repo}
}

// Role operations

func (s *rbacService) CreateRole(ctx context.Context, tenantID uuid.UUID, name, description string) (*domain.Role, error) {
	// Check if role exists
	existing, err := s.repo.GetRoleByName(ctx, tenantID, name)
	if err == nil && existing != nil {
		return nil, ErrRoleExists
	}

	role := &domain.Role{
		TenantID:    tenantID,
		Name:        name,
		Description: description,
	}

	if err := s.repo.CreateRole(ctx, role); err != nil {
		return nil, err
	}

	return role, nil
}

func (s *rbacService) GetRole(ctx context.Context, id uuid.UUID) (*domain.Role, error) {
	role, err := s.repo.GetRole(ctx, id)
	if err != nil {
		return nil, ErrRoleNotFound
	}
	return role, nil
}

func (s *rbacService) GetRoleByName(ctx context.Context, tenantID uuid.UUID, name string) (*domain.Role, error) {
	role, err := s.repo.GetRoleByName(ctx, tenantID, name)
	if err != nil {
		return nil, ErrRoleNotFound
	}
	return role, nil
}

func (s *rbacService) ListRoles(ctx context.Context, tenantID uuid.UUID) ([]*domain.Role, error) {
	return s.repo.ListRoles(ctx, tenantID)
}

func (s *rbacService) UpdateRole(ctx context.Context, id uuid.UUID, name, description string) (*domain.Role, error) {
	role, err := s.GetRole(ctx, id)
	if err != nil {
		return nil, err
	}

	role.Name = name
	role.Description = description

	if err := s.repo.UpdateRole(ctx, role); err != nil {
		return nil, err
	}

	return role, nil
}

func (s *rbacService) DeleteRole(ctx context.Context, id uuid.UUID) error {
	return s.repo.DeleteRole(ctx, id)
}

// Permission operations

func (s *rbacService) ListPermissions(ctx context.Context, category string) ([]*domain.Permission, error) {
	return s.repo.ListPermissions(ctx, category)
}

// User role operations

func (s *rbacService) AssignRole(ctx context.Context, userID, roleID, tenantID uuid.UUID, assignedBy uuid.UUID) error {
	userRole := &domain.UserRole{
		UserID:     userID,
		RoleID:     roleID,
		TenantID:   tenantID,
		IsPrimary:  true,
		AssignedBy: assignedBy,
	}
	return s.repo.AssignRole(ctx, userRole)
}

func (s *rbacService) RemoveRole(ctx context.Context, userID, roleID uuid.UUID) error {
	return s.repo.RemoveRole(ctx, userID, roleID)
}

func (s *rbacService) GetUserRoles(ctx context.Context, userID uuid.UUID) ([]*domain.Role, error) {
	return s.repo.GetUserRoles(ctx, userID)
}

// Seed default data

func (s *rbacService) SeedDefaultData(ctx context.Context) error {
	// Seed permissions
	if err := s.repo.SeedPermissions(ctx); err != nil {
		return err
	}

	return nil
}
