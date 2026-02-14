package services

import (
	"errors"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain"
)

// RoleService handles role and permission-related operations
type RoleService struct {
	DB *gorm.DB
}

// NewRoleService creates a new role service instance
func NewRoleService(db *gorm.DB) *RoleService {
	return &RoleService{
		DB: db,
	}
}

// CreateRole creates a new role with permissions
func (s *RoleService) CreateRole(name, description string, permissionIDs []uuid.UUID, isCustom bool) (*domain.Role, error) {
	// Check if role already exists
	var existingRole domain.Role
	result := s.DB.Where("name = ? AND deleted_at IS NULL", name).First(&existingRole)
	if result.Error == nil {
		return nil, errors.New("role with this name already exists")
	} else if !errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("failed to check for existing role: %w", result.Error)
	}

	// Fetch permissions to ensure they exist
	var permissions []domain.Permission
	if len(permissionIDs) > 0 {
		result = s.DB.Where("id IN ? AND deleted_at IS NULL", permissionIDs).Find(&permissions)
		if result.Error != nil {
			return nil, fmt.Errorf("failed to fetch permissions: %w", result.Error)
		}

		// Check if all requested permissions were found
		if len(permissions) != len(permissionIDs) {
			return nil, errors.New("one or more permissions not found")
		}
	}

	// Create the role
	role := &domain.Role{
		ID:          uuid.New(),
		Name:        name,
		Description: description,
		IsCustom:    isCustom,
		Permissions: permissions,
	}

	result = s.DB.Create(role)
	if result.Error != nil {
		return nil, fmt.Errorf("failed to create role: %w", result.Error)
	}

	return role, nil
}

// GetRoleByID retrieves a role by ID
func (s *RoleService) GetRoleByID(roleID uuid.UUID) (*domain.Role, error) {
	var role domain.Role
	result := s.DB.Preload("Permissions").First(&role, "id = ?", roleID)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return nil, errors.New("role not found")
	}
	if result.Error != nil {
		return nil, fmt.Errorf("failed to retrieve role: %w", result.Error)
	}

	return &role, nil
}

// GetRoleByName retrieves a role by name
func (s *RoleService) GetRoleByName(name string) (*domain.Role, error) {
	var role domain.Role
	result := s.DB.Preload("Permissions").First(&role, "name = ? AND deleted_at IS NULL", name)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return nil, errors.New("role not found")
	}
	if result.Error != nil {
		return nil, fmt.Errorf("failed to retrieve role: %w", result.Error)
	}

	return &role, nil
}

// UpdateRole updates a role's information
func (s *RoleService) UpdateRole(roleID uuid.UUID, name *string, description *string, permissionIDs *[]uuid.UUID) (*domain.Role, error) {
	var role domain.Role
	result := s.DB.First(&role, "id = ? AND deleted_at IS NULL", roleID)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return nil, errors.New("role not found")
	}
	if result.Error != nil {
		return nil, fmt.Errorf("failed to retrieve role: %w", result.Error)
	}

	// If updating the name, check if another role with the same name exists
	if name != nil {
		var existingRole domain.Role
		result = s.DB.Where("name = ? AND id != ? AND deleted_at IS NULL", *name, roleID).First(&existingRole)
		if result.Error == nil {
			return nil, errors.New("role with this name already exists")
		} else if !errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("failed to check for existing role: %w", result.Error)
		}

		role.Name = *name
	}

	if description != nil {
		role.Description = *description
	}

	result = s.DB.Save(&role)
	if result.Error != nil {
		return nil, fmt.Errorf("failed to update role: %w", result.Error)
	}

	// If updating permissions, update the associations
	if permissionIDs != nil {
		var permissions []domain.Permission
		if len(*permissionIDs) > 0 {
			result = s.DB.Where("id IN ? AND deleted_at IS NULL", *permissionIDs).Find(&permissions)
			if result.Error != nil {
				return nil, fmt.Errorf("failed to fetch permissions: %w", result.Error)
			}

			if len(permissions) != len(*permissionIDs) {
				return nil, errors.New("one or more permissions not found")
			}
		}

		// Update the role-permission association
		err := s.DB.Model(&role).Association("Permissions").Replace(permissions)
		if err != nil {
			return nil, fmt.Errorf("failed to update role permissions: %w", err)
		}

		// Reload the role with updated permissions
		result = s.DB.Preload("Permissions").First(&role, "id = ?", roleID)
		if result.Error != nil {
			return nil, fmt.Errorf("failed to reload role: %w", result.Error)
		}
	}

	return &role, nil
}

// DeleteRole deletes a role (soft delete)
func (s *RoleService) DeleteRole(roleID uuid.UUID) error {
	result := s.DB.Delete(&domain.Role{}, "id = ?", roleID)
	if result.Error != nil {
		return fmt.Errorf("failed to delete role: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return errors.New("role not found")
	}

	return nil
}

// ListRoles lists all roles
func (s *RoleService) ListRoles() ([]domain.Role, error) {
	var roles []domain.Role
	result := s.DB.Preload("Permissions").Where("deleted_at IS NULL").Find(&roles)
	if result.Error != nil {
		return nil, fmt.Errorf("failed to list roles: %w", result.Error)
	}

	return roles, nil
}

// AddPermissionToRole adds a permission to a role
func (s *RoleService) AddPermissionToRole(roleID, permissionID uuid.UUID) error {
	var role domain.Role
	result := s.DB.First(&role, "id = ? AND deleted_at IS NULL", roleID)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return errors.New("role not found")
	}
	if result.Error != nil {
		return fmt.Errorf("failed to retrieve role: %w", result.Error)
	}

	var permission domain.Permission
	result = s.DB.First(&permission, "id = ? AND deleted_at IS NULL", permissionID)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return errors.New("permission not found")
	}
	if result.Error != nil {
		return fmt.Errorf("failed to retrieve permission: %w", result.Error)
	}

	err := s.DB.Model(&role).Association("Permissions").Append(&permission)
	if err != nil {
		return fmt.Errorf("failed to add permission to role: %w", err)
	}

	return nil
}

// RemovePermissionFromRole removes a permission from a role
func (s *RoleService) RemovePermissionFromRole(roleID, permissionID uuid.UUID) error {
	var role domain.Role
	result := s.DB.First(&role, "id = ? AND deleted_at IS NULL", roleID)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return errors.New("role not found")
	}
	if result.Error != nil {
		return fmt.Errorf("failed to retrieve role: %w", result.Error)
	}

	var permission domain.Permission
	result = s.DB.First(&permission, "id = ? AND deleted_at IS NULL", permissionID)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return errors.New("permission not found")
	}
	if result.Error != nil {
		return fmt.Errorf("failed to retrieve permission: %w", result.Error)
	}

	err := s.DB.Model(&role).Association("Permissions").Delete(&permission)
	if err != nil {
		return fmt.Errorf("failed to remove permission from role: %w", err)
	}

	return nil
}
