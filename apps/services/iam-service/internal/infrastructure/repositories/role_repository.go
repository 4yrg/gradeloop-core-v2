package repositories

import (
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type RoleRepository struct {
	db *gorm.DB
}

func NewRoleRepository(db *gorm.DB) *RoleRepository {
	return &RoleRepository{db: db}
}

func (r *RoleRepository) CreateRole(role *models.Role) error {
	return r.db.Create(role).Error
}

func (r *RoleRepository) GetRole(id uuid.UUID) (*models.Role, error) {
	var role models.Role
	err := r.db.Preload("Permissions").First(&role, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &role, nil
}

func (r *RoleRepository) GetRoleByName(name string) (*models.Role, error) {
	var role models.Role
	err := r.db.Where("role_name = ?", name).First(&role).Error
	if err != nil {
		return nil, err
	}
	return &role, nil
}

func (r *RoleRepository) ListRoles() ([]models.Role, error) {
	var roles []models.Role
	err := r.db.Preload("Permissions").Find(&roles).Error
	return roles, err
}

func (r *RoleRepository) UpdateRolePermissions(roleID uuid.UUID, permissions []models.Permission) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var role models.Role
		if err := tx.First(&role, "id = ?", roleID).Error; err != nil {
			return err
		}

		// Replace associations (Atomic update to the junction table)
		return tx.Model(&role).Association("Permissions").Replace(permissions)
	})
}

func (r *RoleRepository) DeleteRole(id uuid.UUID) error {
	var role models.Role
	if err := r.db.First(&role, "id = ?", id).Error; err != nil {
		return err
	}
	return r.db.Delete(&role).Error
}

func (r *RoleRepository) GetPermissionsByIDs(ids []uuid.UUID) ([]models.Permission, error) {
	var permissions []models.Permission
	err := r.db.Where("id IN ?", ids).Find(&permissions).Error
	if err != nil {
		return nil, err
	}
	return permissions, nil
}
