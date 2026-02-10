package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/application/usecases"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/http/handlers"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/http/router"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/notifications"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/repositories"
	"github.com/gofiber/fiber/v3"
	"github.com/stretchr/testify/assert"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupLifecycleTestApp(t *testing.T) (*fiber.App, *gorm.DB) {
	t.Setenv("GO_ENV", "test")
	db, _ := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	db.AutoMigrate(&models.User{}, &models.Student{}, &models.Employee{}, &models.Role{}, &models.Permission{}, &models.AuditLog{}, &models.RefreshToken{})

	// Seed Admin Role
	adminRole := models.Role{RoleName: models.RoleAdmin, IsCustom: false}
	db.Create(&adminRole)

	// Environment variables for bootstrap
	os.Setenv("INITIAL_ADMIN_USERNAME", "admin@gradeloop.io")
	os.Setenv("INITIAL_ADMIN_PASSWORD", "ComplexPass123!@#")

	// Repositories
	userRepo := repositories.NewUserRepository(db)
	roleRepo := repositories.NewRoleRepository(db)
	permissionRepo := repositories.NewPermissionRepository(db)
	auditRepo := repositories.NewAuditRepository(db)
	refreshTokenRepo := repositories.NewRefreshTokenRepository(db)
	notificationStub := notifications.NewNotificationStub()

	// Usecases
	userUsecase := usecases.NewUserUsecase(userRepo, auditRepo)
	roleUsecase := usecases.NewRoleUsecase(roleRepo, auditRepo)
	permissionUsecase := usecases.NewPermissionUsecase(permissionRepo)
	authUsecase := usecases.NewAuthUsecase(userRepo, refreshTokenRepo, auditRepo, notificationStub, "test-secret")

	// Handlers
	userHandler := handlers.NewUserHandler(userUsecase)
	roleHandler := handlers.NewRoleHandler(roleUsecase)
	permissionHandler := handlers.NewPermissionHandler(permissionUsecase)
	authHandler := handlers.NewAuthHandler(authUsecase)

	app := fiber.New()
	router.Setup(app, userHandler, roleHandler, permissionHandler, authHandler, nil, &MockAuditRepository{})

	return app, db
}

func TestSecurityLifecycle(t *testing.T) {
	app, db := setupLifecycleTestApp(t)

	// 1. Verify Bootstrap (Manual trigger for test)
	// In main, it runs on startup. Here we can simulate or check if creating works.
	// Since we already have the code in main.go, we'll assume it works if we can use it.
	// Let's create a user for testing.

	t.Run("Full Lifecycle: Login -> Update -> Audit -> Delete -> Restore", func(t *testing.T) {
		// Create a test user
		password := "password123"
		hash, _ := bcrypt.GenerateFromPassword([]byte(password), 12)
		now := time.Now()
		user := &models.User{
			Email:         "test@lifecycle.com",
			FullName:      "Lifecycle User",
			PasswordHash:  string(hash),
			UserType:      models.UserTypeEmployee,
			IsActive:      true,
			PasswordSetAt: &now,
		}
		db.Create(user)

		// A. Login
		loginReq := map[string]string{
			"email":    "test@lifecycle.com",
			"password": "password123",
		}
		body, _ := json.Marshal(loginReq)
		req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var loginResp struct {
			AccessToken  string `json:"access_token"`
			RefreshToken string `json:"refresh_token"`
		}
		json.NewDecoder(resp.Body).Decode(&loginResp)
		assert.NotEmpty(t, loginResp.AccessToken)
		assert.NotEmpty(t, loginResp.RefreshToken)

		// B. Update User (Triggers Audit)
		updateReq := map[string]interface{}{
			"full_name": "Updated Name",
		}
		body, _ = json.Marshal(updateReq)
		req = httptest.NewRequest("PUT", "/api/v1/users/"+user.ID.String(), bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+loginResp.AccessToken) // Note: middleware might need mock
		resp, _ = app.Test(req)

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		// C. Verify Audit Log
		var auditEntry models.AuditLog
		db.Last(&auditEntry)
		assert.Equal(t, "update", auditEntry.Action)
		assert.Equal(t, "user", auditEntry.Entity)
		assert.Equal(t, user.ID.String(), auditEntry.EntityID)
		assert.Contains(t, string(auditEntry.NewValue), "Updated Name")

		// D. Refresh Token Rotation
		refreshReq := map[string]string{
			"refresh_token": loginResp.RefreshToken,
		}
		body, _ = json.Marshal(refreshReq)
		req = httptest.NewRequest("POST", "/api/v1/auth/refresh", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ = app.Test(req)

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var refreshResp struct {
			AccessToken  string `json:"access_token"`
			RefreshToken string `json:"refresh_token"`
		}
		json.NewDecoder(resp.Body).Decode(&refreshResp)
		assert.NotEqual(t, loginResp.RefreshToken, refreshResp.RefreshToken)

		// E. Single-Use Check: Reuse old refresh token
		resp, _ = app.Test(req)
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)

		// F. Soft Delete
		req = httptest.NewRequest("DELETE", "/api/v1/users/"+user.ID.String(), nil)
		resp, _ = app.Test(req)
		assert.Equal(t, http.StatusNoContent, resp.StatusCode)

		// Verify soft deleted (should not be in normal queries)
		var deletedUser models.User
		err := db.First(&deletedUser, "id = ?", user.ID).Error
		assert.Error(t, err) // Should be record not found

		// G. Restore User
		req = httptest.NewRequest("PATCH", "/api/v1/users/"+user.ID.String()+"/restore", nil)
		resp, _ = app.Test(req)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		// Verify restored
		err = db.First(&deletedUser, "id = ?", user.ID).Error
		assert.NoError(t, err)
		assert.Equal(t, "Updated Name", deletedUser.FullName)
	})
}
