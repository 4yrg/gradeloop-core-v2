package repositories_test

import (
	"testing"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/repositories"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupRoleTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect database: %v", err)
	}

	err = db.AutoMigrate(
		&models.Role{},
		&models.Permission{},
		&models.User{},
	)
	if err != nil {
		t.Fatalf("failed to migrate database: %v", err)
	}

	return db
}

func TestRoleRepository_CreateRole(t *testing.T) {
	db := setupRoleTestDB(t)
	repo := repositories.NewRoleRepository(db)

	t.Run("Create Custom Role", func(t *testing.T) {
		role := &models.Role{
			RoleName:    "Test Role",
			Description: "Test Description",
			IsCustom:    true,
		}

		err := repo.CreateRole(role)
		assert.NoError(t, err)
		assert.NotEqual(t, uuid.Nil, role.ID)

		var saved models.Role
		err = db.First(&saved, "id = ?", role.ID).Error
		assert.NoError(t, err)
		assert.Equal(t, "Test Role", saved.RoleName)
		assert.True(t, saved.IsCustom)
	})

	t.Run("Create Duplicate Role Name", func(t *testing.T) {
		role1 := &models.Role{RoleName: "Duplicate"}
		role2 := &models.Role{RoleName: "Duplicate"}

		err := repo.CreateRole(role1)
		assert.NoError(t, err)

		err = repo.CreateRole(role2)
		assert.Error(t, err) // Should fail due to unique constraint
	})
}

func TestRoleRepository_GetRole(t *testing.T) {
	db := setupRoleTestDB(t)
	repo := repositories.NewRoleRepository(db)

	p1 := models.Permission{Name: "iam:test:read", Description: "perm 1"}
	db.Create(&p1)

	role := &models.Role{
		RoleName:    "Role With Perms",
		Permissions: []models.Permission{p1},
	}
	repo.CreateRole(role)

	t.Run("Get Existing Role with Permissions", func(t *testing.T) {
		fetched, err := repo.GetRole(role.ID)
		assert.NoError(t, err)
		assert.Equal(t, role.RoleName, fetched.RoleName)
		assert.Len(t, fetched.Permissions, 1)
		assert.Equal(t, "iam:test:read", fetched.Permissions[0].Name)
	})

	t.Run("Get Non-existent Role", func(t *testing.T) {
		_, err := repo.GetRole(uuid.New())
		assert.Error(t, err)
		assert.Equal(t, gorm.ErrRecordNotFound, err)
	})
}

func TestRoleRepository_UpdateRolePermissions(t *testing.T) {
	db := setupRoleTestDB(t)
	repo := repositories.NewRoleRepository(db)

	p1 := models.Permission{Name: "iam:test:one"}
	p2 := models.Permission{Name: "iam:test:two"}
	db.Create(&p1)
	db.Create(&p2)

	role := &models.Role{RoleName: "Manager"}
	repo.CreateRole(role)

	t.Run("Add Permissions", func(t *testing.T) {
		err := repo.UpdateRolePermissions(role.ID, []models.Permission{p1, p2})
		assert.NoError(t, err)

		fetched, _ := repo.GetRole(role.ID)
		assert.Len(t, fetched.Permissions, 2)
	})

	t.Run("Replace Permissions", func(t *testing.T) {
		err := repo.UpdateRolePermissions(role.ID, []models.Permission{p2})
		assert.NoError(t, err)

		fetched, _ := repo.GetRole(role.ID)
		assert.Len(t, fetched.Permissions, 1)
		assert.Equal(t, "iam:test:two", fetched.Permissions[0].Name)
	})

	t.Run("Clear Permissions", func(t *testing.T) {
		err := repo.UpdateRolePermissions(role.ID, []models.Permission{})
		assert.NoError(t, err)

		fetched, _ := repo.GetRole(role.ID)
		assert.Len(t, fetched.Permissions, 0)
	})
}

func TestRoleRepository_DeleteRole(t *testing.T) {
	db := setupRoleTestDB(t)
	repo := repositories.NewRoleRepository(db)

	role := &models.Role{RoleName: "To Delete", IsCustom: true}
	repo.CreateRole(role)

	t.Run("Successful Delete", func(t *testing.T) {
		err := repo.DeleteRole(role.ID)
		assert.NoError(t, err)

		_, err = repo.GetRole(role.ID)
		assert.Error(t, err)
	})
}

func TestRoleRepository_GetPermissionsByIDs(t *testing.T) {
	db := setupRoleTestDB(t)
	repo := repositories.NewRoleRepository(db)

	p1 := models.Permission{Name: "iam:test:alpha"}
	p2 := models.Permission{Name: "iam:test:beta"}
	db.Create(&p1)
	db.Create(&p2)

	t.Run("Fetch subset", func(t *testing.T) {
		perms, err := repo.GetPermissionsByIDs([]uuid.UUID{p1.ID})
		assert.NoError(t, err)
		assert.Len(t, perms, 1)
		assert.Equal(t, "iam:test:alpha", perms[0].Name)
	})

	t.Run("Empty input", func(t *testing.T) {
		perms, err := repo.GetPermissionsByIDs([]uuid.UUID{})
		assert.NoError(t, err)
		assert.Len(t, perms, 0)
	})
}
