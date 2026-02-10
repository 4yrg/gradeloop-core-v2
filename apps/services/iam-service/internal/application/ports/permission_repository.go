package ports

import (
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
)

type PermissionRepository interface {
	ListPermissions() ([]models.Permission, error)
	GetPermissionByName(name string) (*models.Permission, error)
}
