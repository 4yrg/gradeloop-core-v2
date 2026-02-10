package tests

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/application/usecases"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/http/handlers"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/http/router"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/notifications"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/repositories"
	"github.com/gofiber/fiber/v3"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTestApp(t *testing.T) (*fiber.App, *gorm.DB) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect database: %v", err)
	}

	// Migrate all necessary tables
	err = db.AutoMigrate(
		&models.User{},
		&models.Student{},
		&models.Employee{},
		&models.Role{},
		&models.Permission{},
		&models.AuditLog{},
		&models.RefreshToken{},
	)
	if err != nil {
		t.Fatalf("failed to migrate database: %v", err)
	}

	// Initialize dependencies
	permissionRepo := repositories.NewPermissionRepository(db)
	permissionUsecase := usecases.NewPermissionUsecase(permissionRepo)
	permissionHandler := handlers.NewPermissionHandler(permissionUsecase)

	auditRepo := repositories.NewAuditRepository(db)
	userRepo := repositories.NewUserRepository(db)
	userUsecase := usecases.NewUserUsecase(userRepo, auditRepo)
	userHandler := handlers.NewUserHandler(userUsecase)

	roleRepo := repositories.NewRoleRepository(db)
	roleUsecase := usecases.NewRoleUsecase(roleRepo, auditRepo)
	roleHandler := handlers.NewRoleHandler(roleUsecase)

	notificationStub := notifications.NewNotificationStub()
	refreshTokenRepo := repositories.NewRefreshTokenRepository(db)
	authUsecase := usecases.NewAuthUsecase(userRepo, refreshTokenRepo, auditRepo, notificationStub, "test-secret")
	authHandler := handlers.NewAuthHandler(authUsecase)

	app := fiber.New()
	router.Setup(app, userHandler, roleHandler, permissionHandler, authHandler, nil, &MockAuditRepository{})

	return app, db
}

func TestPermissionAPI_ListPermissions(t *testing.T) {
	app, db := setupTestApp(t)

	// Seed permissions
	perms := []models.Permission{
		{Name: "iam:users:read", Description: "Read users", Category: "IAM", IsCustom: false},
		{Name: "academics:courses:read", Description: "Read courses", Category: "Academics", IsCustom: false},
	}
	for _, p := range perms {
		db.Create(&p)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/permissions", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("failed to test request: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	var result []models.Permission
	body, _ := io.ReadAll(resp.Body)
	json.Unmarshal(body, &result)

	if len(result) != 2 {
		t.Errorf("expected 2 permissions, got %d", len(result))
	}
}

func TestPermissionAPI_GetPermissionByName(t *testing.T) {
	app, db := setupTestApp(t)

	name := "iam:users:create"
	p := models.Permission{Name: name, Description: "Create users", Category: "IAM", IsCustom: false}
	db.Create(&p)

	t.Run("Success", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/permissions/"+name, nil)
		resp, _ := app.Test(req)

		if resp.StatusCode != http.StatusOK {
			t.Errorf("expected status 200, got %d", resp.StatusCode)
		}

		var result models.Permission
		body, _ := io.ReadAll(resp.Body)
		json.Unmarshal(body, &result)

		if result.Name != name {
			t.Errorf("expected permission name %s, got %s", name, result.Name)
		}
	})

	t.Run("NotFound", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/permissions/non:existent:perm", nil)
		resp, _ := app.Test(req)

		if resp.StatusCode != http.StatusNotFound {
			t.Errorf("expected status 404, got %d", resp.StatusCode)
		}
	})
}

func TestPermissionAPI_MethodNotAllowed(t *testing.T) {
	app, _ := setupTestApp(t)

	methods := []string{http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete}
	paths := []string{"/api/v1/permissions", "/api/v1/permissions/iam:users:read"}

	for _, method := range methods {
		for _, path := range paths {
			t.Run(method+" "+path, func(t *testing.T) {
				req := httptest.NewRequest(method, path, nil)
				resp, _ := app.Test(req)

				if resp.StatusCode != http.StatusMethodNotAllowed {
					t.Errorf("expected status 405 for %s %s, got %d", method, path, resp.StatusCode)
				}
			})
		}
	}
}
