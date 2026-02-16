package repository

import (
	"context"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain"
	"gorm.io/gorm"
)

type roleRepository struct {
	db *gorm.DB
}

func NewRoleRepository(db *gorm.DB) domain.RoleRepository {
	return &roleRepository{db: db}
}

func (r *roleRepository) Create(ctx context.Context, role *domain.Role) error {
	return r.db.WithContext(ctx).Create(role).Error
}

func (r *roleRepository) FindByName(ctx context.Context, name string) (*domain.Role, error) {
	var role domain.Role
	err := r.db.WithContext(ctx).Preload("Permissions").First(&role, "name = ?", name).Error
	if err != nil {
		return nil, err
	}
	return &role, nil
}

func (r *roleRepository) FindAll(ctx context.Context) ([]domain.Role, error) {
	var roles []domain.Role
	err := r.db.WithContext(ctx).Preload("Permissions").Find(&roles).Error
	if err != nil {
		return nil, err
	}
	return roles, nil
}

func (r *roleRepository) AssignRole(ctx context.Context, userID, roleID string) error {
	// GORM many-to-many: user.Roles = append(user.Roles, role)
	// Or using manual association insert specific for user_roles table?
	// Easiest is to traverse via User model.

	// Option 1: Load user, append role, save.
	// Option 2: Use Association mode.

	// We need structs.
	user := domain.User{ID: userID}
	role := domain.Role{ID: roleID}

	return r.db.WithContext(ctx).Model(&user).Association("Roles").Append(&role)
}

func (r *roleRepository) GetRolesByUserID(ctx context.Context, userID string) ([]domain.Role, error) {
	var roles []domain.Role
	// Join with user_roles? Or simple association find?
	// association find: db.Model(&user).Association("Roles").Find(&roles)
	// But we usually want to find roles where user_id = ?
	// "SELECT * FROM roles JOIN user_roles ON user_roles.role_id = roles.id WHERE user_roles.user_id = ?"

	// Using Query:
	err := r.db.WithContext(ctx).
		Joins("JOIN user_roles ON user_roles.role_id = roles.id").
		Where("user_roles.user_id = ?", userID).
		Preload("Permissions").
		Find(&roles).Error

	return roles, err
}
