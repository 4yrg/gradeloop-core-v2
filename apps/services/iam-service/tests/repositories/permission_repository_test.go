package repositories_test

import (
	"testing"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/repositories"
	_ "github.com/glebarez/sqlite"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupPermissionTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect database: %v", err)
	}

	err = db.AutoMigrate(&models.Permission{})
	if err != nil {
		t.Fatalf("failed to migrate database: %v", err)
	}

	return db
}

func TestPermissionRepository_ListPermissions(t *testing.T) {
	db := setupPermissionTestDB(t)
	repo := repositories.NewPermissionRepository(db)

	permissions := []models.Permission{
		{Name: "iam:users:read", Description: "Read users", Category: "IAM"},
		{Name: "iam:users:write", Description: "Write users", Category: "IAM"},
	}

	for _, p := range permissions {
		if err := db.Create(&p).Error; err != nil {
			t.Fatalf("failed to seed permission: %v", err)
		}
	}

	result, err := repo.ListPermissions()
	if err != nil {
		t.Errorf("expected no error, got %v", err)
	}

	if len(result) != 2 {
		t.Errorf("expected 2 permissions, got %d", len(result))
	}
}

func TestPermissionRepository_GetPermissionByName(t *testing.T) {
	db := setupPermissionTestDB(t)
	repo := repositories.NewPermissionRepository(db)

	name := "academics:courses:read"
	p := models.Permission{
		Name:        name,
		Description: "Read courses",
		Category:    "Academics",
	}
	if err := db.Create(&p).Error; err != nil {
		t.Fatalf("failed to seed permission: %v", err)
	}

	t.Run("Success", func(t *testing.T) {
		result, err := repo.GetPermissionByName(name)
		if err != nil {
			t.Errorf("expected no error, got %v", err)
		}
		if result == nil || result.Name != name {
			t.Errorf("expected permission with name %s, got %v", name, result)
		}
	})

	t.Run("NotFound", func(t *testing.T) {
		result, err := repo.GetPermissionByName("non:existent:perm")
		if err == nil {
			t.Error("expected error for non-existent permission, got nil")
		}
		if result != nil {
			t.Errorf("expected nil result, got %v", result)
		}
	})
}

func TestPermissionRepository_Constraints(t *testing.T) {
	db := setupPermissionTestDB(t)

	t.Run("InvalidNamePattern", func(t *testing.T) {
		p := models.Permission{Name: "invalid-name"}
		err := db.Create(&p).Error
		if err == nil {
			t.Error("expected error for invalid name pattern, got nil")
		}
	})

	t.Run("Immutability_Update", func(t *testing.T) {
		p := models.Permission{Name: "iam:test:update"}
		db.Create(&p)

		p.Description = "New Description"
		err := db.Save(&p).Error
		if err == nil || err.Error() != "permissions are immutable at runtime" {
			t.Errorf("expected immutability error on update, got %v", err)
		}
	})

	t.Run("Immutability_Delete", func(t *testing.T) {
		p := models.Permission{Name: "iam:test:delete"}
		db.Create(&p)

		err := db.Delete(&p).Error
		if err == nil || err.Error() != "permissions are immutable at runtime" {
			t.Errorf("expected immutability error on delete, got %v", err)
		}
	})
}
