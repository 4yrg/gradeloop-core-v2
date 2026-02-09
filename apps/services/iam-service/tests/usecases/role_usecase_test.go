package usecases_test

import (
	"context"
	"testing"

	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/application/usecases"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"gorm.io/gorm"
)

func TestRoleUsecase_CreateRole(t *testing.T) {
	mockRoleRepo := new(MockRoleRepository)
	mockAuditRepo := new(MockAuditRepository)
	uc := usecases.NewRoleUsecase(mockRoleRepo, mockAuditRepo)
	ctx := context.Background()

	t.Run("successfully create custom role", func(t *testing.T) {
		role := &models.Role{RoleName: "Custom Manager"}

		mockRoleRepo.On("GetRoleByName", "Custom Manager").Return(nil, gorm.ErrRecordNotFound).Once()
		mockRoleRepo.On("CreateRole", mock.Anything).Return(nil).Once()
		mockAuditRepo.On("CreateAuditLog", ctx, mock.Anything).Return(nil).Once()

		result, err := uc.CreateRole(ctx, role)
		assert.NoError(t, err)
		assert.True(t, result.IsCustom)
		mockRoleRepo.AssertExpectations(t)
	})

	t.Run("fail on duplicate role name", func(t *testing.T) {
		role := &models.Role{RoleName: "Admin"}
		existing := &models.Role{RoleName: "Admin", ID: uuid.New()}

		mockRoleRepo.On("GetRoleByName", "Admin").Return(existing, nil).Once()

		_, err := uc.CreateRole(ctx, role)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "already exists")
	})

	t.Run("reserved role is not custom", func(t *testing.T) {
		role := &models.Role{RoleName: "admin"}

		mockRoleRepo.On("GetRoleByName", "admin").Return(nil, gorm.ErrRecordNotFound).Once()
		mockRoleRepo.On("CreateRole", mock.MatchedBy(func(r *models.Role) bool {
			return r.RoleName == "admin" && r.IsCustom == false
		})).Return(nil).Once()
		mockAuditRepo.On("CreateAuditLog", ctx, mock.Anything).Return(nil).Once()

		result, err := uc.CreateRole(ctx, role)
		assert.NoError(t, err)
		assert.False(t, result.IsCustom)
	})
}

func TestRoleUsecase_ListRoles(t *testing.T) {
	mockRoleRepo := new(MockRoleRepository)
	mockAuditRepo := new(MockAuditRepository)
	uc := usecases.NewRoleUsecase(mockRoleRepo, mockAuditRepo)
	ctx := context.Background()

	t.Run("successfully list roles", func(t *testing.T) {
		roles := []models.Role{{RoleName: "Admin"}, {RoleName: "User"}}
		mockRoleRepo.On("ListRoles").Return(roles, nil).Once()

		result, err := uc.ListRoles(ctx)
		assert.NoError(t, err)
		assert.Len(t, result, 2)
		mockRoleRepo.AssertExpectations(t)
	})
}

func TestRoleUsecase_UpdateRolePermissions(t *testing.T) {
	mockRoleRepo := new(MockRoleRepository)
	mockAuditRepo := new(MockAuditRepository)
	uc := usecases.NewRoleUsecase(mockRoleRepo, mockAuditRepo)
	ctx := context.Background()
	roleID := uuid.New()

	t.Run("successful update", func(t *testing.T) {
		pID := uuid.New()
		role := &models.Role{ID: roleID, RoleName: "Editor"}
		perms := []models.Permission{{ID: pID, Name: "iam:test:edit"}}

		mockRoleRepo.On("GetRole", roleID).Return(role, nil).Once()
		mockRoleRepo.On("GetPermissionsByIDs", []uuid.UUID{pID}).Return(perms, nil).Once()
		mockRoleRepo.On("UpdateRolePermissions", roleID, perms).Return(nil).Once()
		mockAuditRepo.On("CreateAuditLog", ctx, mock.Anything).Return(nil).Once()

		err := uc.UpdateRolePermissions(ctx, roleID, []uuid.UUID{pID})
		assert.NoError(t, err)
		mockRoleRepo.AssertExpectations(t)
	})

	t.Run("fail if permission not found", func(t *testing.T) {
		pID := uuid.New()
		role := &models.Role{ID: roleID}

		mockRoleRepo.On("GetRole", roleID).Return(role, nil).Once()
		mockRoleRepo.On("GetPermissionsByIDs", []uuid.UUID{pID}).Return([]models.Permission{}, nil).Once()

		err := uc.UpdateRolePermissions(ctx, roleID, []uuid.UUID{pID})
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "one or more permissions do not exist")
	})
}

func TestRoleUsecase_DeleteRole(t *testing.T) {
	mockRoleRepo := new(MockRoleRepository)
	mockAuditRepo := new(MockAuditRepository)
	uc := usecases.NewRoleUsecase(mockRoleRepo, mockAuditRepo)
	ctx := context.Background()

	t.Run("successfully delete custom role", func(t *testing.T) {
		id := uuid.New()
		role := &models.Role{ID: id, RoleName: "Temporary", IsCustom: true}

		mockRoleRepo.On("GetRole", id).Return(role, nil).Once()
		mockRoleRepo.On("DeleteRole", id).Return(nil).Once()
		mockAuditRepo.On("CreateAuditLog", ctx, mock.Anything).Return(nil).Once()

		err := uc.DeleteRole(ctx, id)
		assert.NoError(t, err)
	})

	t.Run("fail to delete reserved role", func(t *testing.T) {
		id := uuid.New()
		role := &models.Role{ID: id, RoleName: "admin", IsCustom: false}

		mockRoleRepo.On("GetRole", id).Return(role, nil).Once()

		err := uc.DeleteRole(ctx, id)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "reserved roles")
	})
}
