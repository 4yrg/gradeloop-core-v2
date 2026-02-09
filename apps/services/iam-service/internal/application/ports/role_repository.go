package ports

import (
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"github.com/google/uuid"
)

type RoleRepository interface {
	CreateRole(role *models.Role) error
	GetRole(id uuid.UUID) (*models.Role, error)
	GetRoleByName(name string) (*models.Role, error)
	ListRoles() ([]models.Role, error)
	UpdateRolePermissions(roleID uuid.UUID, permissions []models.Permission) error
	DeleteRole(id uuid.UUID) error
	GetPermissionsByIDs(ids []uuid.UUID) ([]models.Permission, error)
}
