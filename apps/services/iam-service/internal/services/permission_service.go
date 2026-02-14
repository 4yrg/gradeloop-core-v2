package services

import (
	"errors"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain"
)

// PermissionService handles permission-related operations
type PermissionService struct {
	DB *gorm.DB
}

// NewPermissionService creates a new permission service instance
func NewPermissionService(db *gorm.DB) *PermissionService {
	return &PermissionService{
		DB: db,
	}
}

// CreatePermission creates a new permission
func (s *PermissionService) CreatePermission(name, description string) (*domain.Permission, error) {
	// Check if permission already exists
	var existingPermission domain.Permission
	result := s.DB.Where("name = ? AND deleted_at IS NULL", name).First(&existingPermission)
	if result.Error == nil {
		return nil, errors.New("permission with this name already exists")
	} else if !errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("failed to check for existing permission: %w", result.Error)
	}

	// Create the permission
	permission := &domain.Permission{
		ID:          uuid.New(),
		Name:        name,
		Description: description,
	}

	result = s.DB.Create(permission)
	if result.Error != nil {
		return nil, fmt.Errorf("failed to create permission: %w", result.Error)
	}

	return permission, nil
}

// GetPermissionByID retrieves a permission by ID
func (s *PermissionService) GetPermissionByID(permissionID uuid.UUID) (*domain.Permission, error) {
	var permission domain.Permission
	result := s.DB.First(&permission, "id = ? AND deleted_at IS NULL", permissionID)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return nil, errors.New("permission not found")
	}
	if result.Error != nil {
		return nil, fmt.Errorf("failed to retrieve permission: %w", result.Error)
	}

	return &permission, nil
}

// GetPermissionByName retrieves a permission by name
func (s *PermissionService) GetPermissionByName(name string) (*domain.Permission, error) {
	var permission domain.Permission
	result := s.DB.First(&permission, "name = ? AND deleted_at IS NULL", name)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return nil, errors.New("permission not found")
	}
	if result.Error != nil {
		return nil, fmt.Errorf("failed to retrieve permission: %w", result.Error)
	}

	return &permission, nil
}

// UpdatePermission updates a permission's information
func (s *PermissionService) UpdatePermission(permissionID uuid.UUID, name *string, description *string) (*domain.Permission, error) {
	var permission domain.Permission
	result := s.DB.First(&permission, "id = ? AND deleted_at IS NULL", permissionID)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return nil, errors.New("permission not found")
	}
	if result.Error != nil {
		return nil, fmt.Errorf("failed to retrieve permission: %w", result.Error)
	}

	// If updating the name, check if another permission with the same name exists
	if name != nil {
		var existingPermission domain.Permission
		result = s.DB.Where("name = ? AND id != ? AND deleted_at IS NULL", *name, permissionID).First(&existingPermission)
		if result.Error == nil {
			return nil, errors.New("permission with this name already exists")
		} else if !errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("failed to check for existing permission: %w", result.Error)
		}

		permission.Name = *name
	}

	if description != nil {
		permission.Description = *description
	}

	result = s.DB.Save(&permission)
	if result.Error != nil {
		return nil, fmt.Errorf("failed to update permission: %w", result.Error)
	}

	return &permission, nil
}

// DeletePermission deletes a permission (soft delete)
func (s *PermissionService) DeletePermission(permissionID uuid.UUID) error {
	result := s.DB.Delete(&domain.Permission{}, "id = ?", permissionID)
	if result.Error != nil {
		return fmt.Errorf("failed to delete permission: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return errors.New("permission not found")
	}

	return nil
}

// ListPermissions lists all permissions
func (s *PermissionService) ListPermissions() ([]domain.Permission, error) {
	var permissions []domain.Permission
	result := s.DB.Where("deleted_at IS NULL").Find(&permissions)
	if result.Error != nil {
		return nil, fmt.Errorf("failed to list permissions: %w", result.Error)
	}

	return permissions, nil
}
