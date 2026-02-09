package usecases

import (
	"context"
	"errors"
	"fmt"

	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/application/ports"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/application/utils"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type RoleUsecase struct {
	roleRepo  ports.RoleRepository
	auditRepo ports.AuditRepository
}

func NewRoleUsecase(roleRepo ports.RoleRepository, auditRepo ports.AuditRepository) *RoleUsecase {
	return &RoleUsecase{
		roleRepo:  roleRepo,
		auditRepo: auditRepo,
	}
}

func (uc *RoleUsecase) CreateRole(ctx context.Context, role *models.Role) (*models.Role, error) {
	// Check if role name already exists (Requirement: Return 409 for duplicate role names)
	existing, err := uc.roleRepo.GetRoleByName(role.RoleName)
	if err == nil && existing != nil {
		return nil, fmt.Errorf("role with name %s already exists", role.RoleName)
	} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	// Immutability: Hardcode logic to protect reserved roles (admin, instructor, student)
	// Set is_custom=true for any role created via the API that is not in the reserved list.
	if _, ok := models.ReservedRoles[role.RoleName]; ok {
		role.IsCustom = false
	} else {
		role.IsCustom = true
	}

	if err := uc.roleRepo.CreateRole(role); err != nil {
		return nil, err
	}

	// Integrate with the existing Audit Log system (E02/US02)
	uc.logAudit(ctx, "CREATE_ROLE", "Role", role.ID.String(), nil, role)

	return role, nil
}

func (uc *RoleUsecase) ListRoles(ctx context.Context) ([]models.Role, error) {
	// List roles, including an array of their associated permissions
	return uc.roleRepo.ListRoles()
}

func (uc *RoleUsecase) UpdateRolePermissions(ctx context.Context, roleID uuid.UUID, permissionIDs []uuid.UUID) error {
	role, err := uc.roleRepo.GetRole(roleID)
	if err != nil {
		return err
	}

	// Permissions are pre-defined. Ensure we check existence.
	var permissions []models.Permission
	if len(permissionIDs) > 0 {
		permissions, err = uc.roleRepo.GetPermissionsByIDs(permissionIDs)
		if err != nil {
			return err
		}

		// Validation: Return 400 for non-existent permissions
		if len(permissions) != len(permissionIDs) {
			return errors.New("one or more permissions do not exist")
		}
	}

	// Ensure all permission updates are wrapped in a database transaction (handled in repository)
	// Atomically replace the permission set for a role.
	if err := uc.roleRepo.UpdateRolePermissions(roleID, permissions); err != nil {
		return err
	}

	// Integrate with the existing Audit Log system (E02/US02)
	uc.logAudit(ctx, "UPDATE_ROLE_PERMISSIONS", "Role", roleID.String(), role.Permissions, permissions)

	return nil
}

func (uc *RoleUsecase) DeleteRole(ctx context.Context, id uuid.UUID) error {
	role, err := uc.roleRepo.GetRole(id)
	if err != nil {
		return err
	}

	// Immutability: Hardcode logic to protect reserved roles (admin, instructor, student)
	// Soft or hard delete allowed only if is_custom is true.
	if !role.IsCustom {
		return errors.New("reserved roles (admin, instructor, student) cannot be deleted")
	}

	if err := uc.roleRepo.DeleteRole(id); err != nil {
		return err
	}

	// Integrate with the existing Audit Log system (E02/US02)
	uc.logAudit(ctx, "DELETE_ROLE", "Role", id.String(), role, nil)

	return nil
}

// logAudit integrates with the existing Audit Log system (E02/US02) to record all mutations.
func (uc *RoleUsecase) logAudit(ctx context.Context, action, entity, entityID string, oldValue, newValue interface{}) {
	auditLog := utils.PrepareAuditLog(ctx, action, entity, entityID, oldValue, newValue)
	// Best effort audit logging
	_ = uc.auditRepo.CreateAuditLog(ctx, auditLog)
}
