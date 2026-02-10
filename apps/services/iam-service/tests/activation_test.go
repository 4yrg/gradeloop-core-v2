package tests

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/application/usecases"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/application/utils"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/http/handlers"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/http/router"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/notifications"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/repositories"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

const activationTestSecret = "test-secret-key-12345"

func setupActivationTestApp(t *testing.T) (*fiber.App, *gorm.DB) {
	t.Setenv("GO_ENV", "test")
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect database: %v", err)
	}

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

	userRepo := repositories.NewUserRepository(db)
	refreshTokenRepo := repositories.NewRefreshTokenRepository(db)
	notificationStub := notifications.NewNotificationStub()
	auditRepo := repositories.NewAuditRepository(db)
	authUsecase := usecases.NewAuthUsecase(userRepo, refreshTokenRepo, auditRepo, notificationStub, activationTestSecret)

	userUsecase := usecases.NewUserUsecase(userRepo, auditRepo)
	roleRepo := repositories.NewRoleRepository(db)
	roleUsecase := usecases.NewRoleUsecase(roleRepo, auditRepo)
	permissionRepo := repositories.NewPermissionRepository(db)
	permissionUsecase := usecases.NewPermissionUsecase(permissionRepo)

	authHandler := handlers.NewAuthHandler(authUsecase)
	userHandler := handlers.NewUserHandler(userUsecase)
	roleHandler := handlers.NewRoleHandler(roleUsecase)
	permissionHandler := handlers.NewPermissionHandler(permissionUsecase)

	app := fiber.New()
	router.Setup(app, userHandler, roleHandler, permissionHandler, authHandler)

	return app, db
}

func TestAccountActivationFlow(t *testing.T) {
	app, db := setupActivationTestApp(t)

	// Create an inactive user
	user := models.User{
		ID:           uuid.New(),
		Email:        "newuser@example.com",
		FullName:     "New User",
		PasswordHash: "initial-dummy-hash",
		UserType:     models.UserTypeStudent,
		IsActive:     true,
	}
	db.Create(&user)

	t.Run("Token Expiry (15m)", func(t *testing.T) {
		tokenID := uuid.New()
		// Update user with token ID in DB
		db.Model(&user).Update("activation_token_id", tokenID)

		// Generate an expired token (expired 1 minute ago)
		expiredToken, _ := utils.GenerateActivationToken(user.ID, tokenID, activationTestSecret, -1*time.Minute)

		reqBody := map[string]string{
			"token":    expiredToken,
			"password": "StrongPassword123!",
		}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/activate", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)

		var result map[string]string
		respBody, _ := io.ReadAll(resp.Body)
		json.Unmarshal(respBody, &result)
		assert.Contains(t, result["error"], "expired")
	})

	t.Run("Password Policy Enforcement", func(t *testing.T) {
		tokenID := uuid.New()
		db.Model(&user).Update("activation_token_id", tokenID)

		validToken, _ := utils.GenerateActivationToken(user.ID, tokenID, activationTestSecret, 15*time.Minute)

		weakPasswords := []string{
			"short123!",         // < 12 chars
			"lowercaseonly123!", // missing uppercase
			"UPPERCASEONLY123!", // missing lowercase
			"NoSpecialChar123A", // missing symbol
		}

		for _, pw := range weakPasswords {
			reqBody := map[string]string{
				"token":    validToken,
				"password": pw,
			}
			body, _ := json.Marshal(reqBody)
			req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/activate", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")

			resp, err := app.Test(req)
			assert.NoError(t, err)
			assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
		}
	})

	t.Run("Successful Activation", func(t *testing.T) {
		tokenID := uuid.New()
		db.Model(&user).Update("activation_token_id", tokenID)

		validToken, _ := utils.GenerateActivationToken(user.ID, tokenID, activationTestSecret, 15*time.Minute)

		reqBody := map[string]string{
			"token":    validToken,
			"password": "VeryStrongPassword@2024",
		}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/activate", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		// Verify DB updates
		var updatedUser models.User
		db.First(&updatedUser, user.ID)
		assert.NotNil(t, updatedUser.PasswordSetAt)
		assert.Nil(t, updatedUser.ActivationTokenID)
		assert.True(t, updatedUser.IsPasswordResetRequired)
	})

	t.Run("Single-Use Validation (Token Reuse)", func(t *testing.T) {
		// Even if we generate a token for the user, if the ActivationTokenID was cleared, it should fail.
		tokenID := uuid.New()
		validToken, _ := utils.GenerateActivationToken(user.ID, tokenID, activationTestSecret, 15*time.Minute)

		reqBody := map[string]string{
			"token":    validToken,
			"password": "AnotherStrongPassword!123",
		}
		body, _ := json.Marshal(reqBody)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/activate", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req)
		assert.NoError(t, err)
		// Should return 403 Forbidden as per Requirement: Return a 403 Forbidden error if a token is reused.
		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})
}
