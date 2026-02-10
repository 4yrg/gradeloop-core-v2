package usecases

import (
	"context"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/application/ports"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
)

type PermissionUsecase struct {
	permissionRepo ports.PermissionRepository
}

func NewPermissionUsecase(permissionRepo ports.PermissionRepository) *PermissionUsecase {
	return &PermissionUsecase{
		permissionRepo: permissionRepo,
	}
}

// ListPermissions returns all available permissions in the catalog.
func (uc *PermissionUsecase) ListPermissions(ctx context.Context) ([]models.Permission, error) {
	return uc.permissionRepo.ListPermissions()
}

// GetPermissionByName retrieves a specific permission by its name/slug.
func (uc *PermissionUsecase) GetPermissionByName(ctx context.Context, name string) (*models.Permission, error) {
	return uc.permissionRepo.GetPermissionByName(name)
}
