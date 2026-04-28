package repository

import (
	"context"
	"errors"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/domain"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// RBACRepository defines operations for roles and permissions
type RBACRepository interface {
	// Roles
	CreateRole(ctx context.Context, role *domain.Role) error
	GetRole(ctx context.Context, id uuid.UUID) (*domain.Role, error)
	GetRoleByName(ctx context.Context, tenantID uuid.UUID, name string) (*domain.Role, error)
	ListRoles(ctx context.Context, tenantID uuid.UUID) ([]*domain.Role, error)
	UpdateRole(ctx context.Context, role *domain.Role) error
	DeleteRole(ctx context.Context, id uuid.UUID) error

	// Permissions
	CreatePermission(ctx context.Context, perm *domain.Permission) error
	GetPermission(ctx context.Context, id uuid.UUID) (*domain.Permission, error)
	GetPermissionByAction(ctx context.Context, action string) (*domain.Permission, error)
	ListPermissions(ctx context.Context, category string) ([]*domain.Permission, error)
	SeedPermissions(ctx context.Context) error

	// User Roles
	AssignRole(ctx context.Context, userRole *domain.UserRole) error
	RemoveRole(ctx context.Context, userID, roleID uuid.UUID) error
	GetUserRoles(ctx context.Context, userID uuid.UUID) ([]*domain.Role, error)
	GetUserPermissions(ctx context.Context, userID uuid.UUID) ([]string, error)

	// Role Permissions
	AssignPermission(ctx context.Context, roleID, permID uuid.UUID) error
	RemovePermission(ctx context.Context, roleID, permID uuid.UUID) error
	GetRolePermissions(ctx context.Context, roleID uuid.UUID) ([]*domain.Permission, error)
}

type rbacRepository struct {
	db *gorm.DB
}

// NewRBACRepository creates a new RBAC repository
func NewRBACRepository(db *gorm.DB) RBACRepository {
	return &rbacRepository{db: db}
}

// Role operations

func (r *rbacRepository) CreateRole(ctx context.Context, role *domain.Role) error {
	role.ID = uuid.New()
	return r.db.WithContext(ctx).Create(role).Error
}

func (r *rbacRepository) GetRole(ctx context.Context, id uuid.UUID) (*domain.Role, error) {
	var role domain.Role
	err := r.db.WithContext(ctx).
		Where("id = ?", id).
		First(&role).Error
	return &role, err
}

func (r *rbacRepository) GetRoleByName(ctx context.Context, tenantID uuid.UUID, name string) (*domain.Role, error) {
	var role domain.Role
	err := r.db.WithContext(ctx).
		Where("tenant_id = ? AND name = ?", tenantID, name).
		First(&role).Error
	return &role, err
}

func (r *rbacRepository) ListRoles(ctx context.Context, tenantID uuid.UUID) ([]*domain.Role, error) {
	var roles []*domain.Role
	err := r.db.WithContext(ctx).
		Where("tenant_id = ?", tenantID).
		Order("name ASC").
		Find(&roles).Error
	return roles, err
}

func (r *rbacRepository) UpdateRole(ctx context.Context, role *domain.Role) error {
	return r.db.WithContext(ctx).Save(role).Error
}

func (r *rbacRepository) DeleteRole(ctx context.Context, id uuid.UUID) error {
	var role domain.Role
	result := r.db.WithContext(ctx).First(&role, "id = ?", id)
	if result.Error != nil {
		return result.Error
	}
	if role.IsSystem {
		return errors.New("cannot delete system role")
	}
	return r.db.WithContext(ctx).Delete(&role).Error
}

// Permission operations

func (r *rbacRepository) CreatePermission(ctx context.Context, perm *domain.Permission) error {
	perm.ID = uuid.New()
	return r.db.WithContext(ctx).Create(perm).Error
}

func (r *rbacRepository) GetPermission(ctx context.Context, id uuid.UUID) (*domain.Permission, error) {
	var perm domain.Permission
	err := r.db.WithContext(ctx).
		Where("id = ?", id).
		First(&perm).Error
	return &perm, err
}

func (r *rbacRepository) GetPermissionByAction(ctx context.Context, action string) (*domain.Permission, error) {
	var perm domain.Permission
	err := r.db.WithContext(ctx).
		Where("action = ?", action).
		First(&perm).Error
	return &perm, err
}

func (r *rbacRepository) ListPermissions(ctx context.Context, category string) ([]*domain.Permission, error) {
	var perms []*domain.Permission
	query := r.db.WithContext(ctx)
	if category != "" {
		query = query.Where("category = ?", category)
	}
	err := query.Order("category ASC, action ASC").Find(&perms).Error
	return perms, err
}

func (r *rbacRepository) SeedPermissions(ctx context.Context) error {
	perms := domain.DefaultPermissions()
	for _, p := range perms {
		// Check if exists
		var existing domain.Permission
		err := r.db.WithContext(ctx).Where("action = ?", p.Action).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			if err := r.db.WithContext(ctx).Create(p).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

// User role operations

func (r *rbacRepository) AssignRole(ctx context.Context, userRole *domain.UserRole) error {
	userRole.ID = uuid.New()
	return r.db.WithContext(ctx).Create(userRole).Error
}

func (r *rbacRepository) RemoveRole(ctx context.Context, userID, roleID uuid.UUID) error {
	return r.db.WithContext(ctx).
		Where("user_id = ? AND role_id = ?", userID, roleID).
		Delete(&domain.UserRole{}).Error
}

func (r *rbacRepository) GetUserRoles(ctx context.Context, userID uuid.UUID) ([]*domain.Role, error) {
	var roles []*domain.Role
	err := r.db.WithContext(ctx).
		Joins("JOIN user_roles ON user_roles.role_id = roles.id").
		Where("user_roles.user_id = ?", userID).
		Find(&roles).Error
	return roles, err
}

func (r *rbacRepository) GetUserPermissions(ctx context.Context, userID uuid.UUID) ([]string, error) {
	var perms []string
	err := r.db.WithContext(ctx).
		Table("role_permissions").
		Select("DISTINCT permissions.action").
		Joins("JOIN roles ON roles.id = role_permissions.role_id").
		Joins("JOIN user_roles ON user_roles.role_id = roles.id").
		Where("user_roles.user_id = ?", userID).
		Pluck("permissions.action", &perms).Error
	return perms, err
}

// Role permission operations

func (r *rbacRepository) AssignPermission(ctx context.Context, roleID, permID uuid.UUID) error {
	rp := domain.RolePermission{
		ID:           uuid.New(),
		RoleID:       roleID,
		PermissionID: permID,
	}
	return r.db.WithContext(ctx).Create(&rp).Error
}

func (r *rbacRepository) RemovePermission(ctx context.Context, roleID, permID uuid.UUID) error {
	return r.db.WithContext(ctx).
		Where("role_id = ? AND permission_id = ?", roleID, permID).
		Delete(&domain.RolePermission{}).Error
}

func (r *rbacRepository) GetRolePermissions(ctx context.Context, roleID uuid.UUID) ([]*domain.Permission, error) {
	var perms []*domain.Permission
	err := r.db.WithContext(ctx).
		Table("permissions").
		Select("permissions.*").
		Joins("JOIN role_permissions ON role_permissions.permission_id = permissions.id").
		Where("role_permissions.role_id = ?", roleID).
		Find(&perms).Error
	return perms, err
}
