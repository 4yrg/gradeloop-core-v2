package repositories

import (
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"gorm.io/gorm"
)

type PermissionRepository struct {
	db *gorm.DB
}

func NewPermissionRepository(db *gorm.DB) *PermissionRepository {
	return &PermissionRepository{db: db}
}

// ListPermissions returns all permissions in the catalog.
func (r *PermissionRepository) ListPermissions() ([]models.Permission, error) {
	var permissions []models.Permission
	err := r.db.Find(&permissions).Error
	return permissions, err
}

// GetPermissionByName retrieves a specific permission by its name/slug.
func (r *PermissionRepository) GetPermissionByName(name string) (*models.Permission, error) {
	var permission models.Permission
	err := r.db.Where("name = ?", name).First(&permission).Error
	if err != nil {
		return nil, err
	}
	return &permission, nil
}
