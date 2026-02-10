package tests

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/application/usecases"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/http/handlers"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/http/router"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/notifications"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/repositories"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupAuthTestApp(t *testing.T) (*fiber.App, *gorm.DB) {
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

	// Initialize repositories
	userRepo := repositories.NewUserRepository(db)
	roleRepo := repositories.NewRoleRepository(db)
	auditRepo := repositories.NewAuditRepository(db)
	permissionRepo := repositories.NewPermissionRepository(db)
	refreshTokenRepo := repositories.NewRefreshTokenRepository(db)

	// Initialize usecases
	userUsecase := usecases.NewUserUsecase(userRepo, auditRepo)
	roleUsecase := usecases.NewRoleUsecase(roleRepo, auditRepo)
	permissionUsecase := usecases.NewPermissionUsecase(permissionRepo)
	notificationStub := notifications.NewNotificationStub()
	authUsecase := usecases.NewAuthUsecase(userRepo, refreshTokenRepo, auditRepo, notificationStub, "test-secret")

	// Initialize handlers
	userHandler := handlers.NewUserHandler(userUsecase)
	roleHandler := handlers.NewRoleHandler(roleUsecase)
	permissionHandler := handlers.NewPermissionHandler(permissionUsecase)
	authHandler := handlers.NewAuthHandler(authUsecase)

	app := fiber.New()
	router.Setup(app, userHandler, roleHandler, permissionHandler, authHandler, nil, &MockAuditRepository{})

	return app, db
}

func TestRefreshTokenLifecycle(t *testing.T) {
	app, db := setupAuthTestApp(t)

	// Seed a test user
	password := "password123"
	hash, _ := bcrypt.GenerateFromPassword([]byte(password), 12)
	now := time.Now()
	user := models.User{
		ID:            uuid.New(),
		Email:         "test@example.com",
		FullName:      "Test User",
		PasswordHash:  string(hash),
		UserType:      models.UserTypeEmployee,
		IsActive:      true,
		PasswordSetAt: &now,
	}
	db.Create(&user)

	var currentRefreshToken string

	t.Run("Login Successful", func(t *testing.T) {
		loginReq := map[string]string{
			"email":    "test@example.com",
			"password": "password123",
		}
		body, _ := json.Marshal(loginReq)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req)
		if err != nil {
			t.Fatalf("failed to test request: %v", err)
		}

		if resp.StatusCode != http.StatusOK {
			t.Errorf("expected status 200, got %d", resp.StatusCode)
		}

		var result map[string]interface{}
		respBody, _ := io.ReadAll(resp.Body)
		json.Unmarshal(respBody, &result)

		accessToken := result["access_token"].(string)
		if accessToken == "" {
			t.Error("expected access token in response")
		}

		currentRefreshToken = result["refresh_token"].(string)
		if currentRefreshToken == "" {
			t.Error("expected refresh token in response")
		}
	})

	t.Run("Refresh Successful (Rotation)", func(t *testing.T) {
		refreshReq := map[string]string{
			"refresh_token": currentRefreshToken,
		}
		body, _ := json.Marshal(refreshReq)
		req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/refresh", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")

		resp, _ := app.Test(req)
		if resp.StatusCode != http.StatusOK {
			t.Errorf("expected status 200, got %d", resp.StatusCode)
		}

		var result map[string]interface{}
		respBody, _ := io.ReadAll(resp.Body)
		json.Unmarshal(respBody, &result)

		newAccessToken := result["access_token"].(string)
		if newAccessToken == "" {
			t.Error("expected a new access token")
		}

		newRefreshToken := result["refresh_token"].(string)
		if newRefreshToken == "" || newRefreshToken == currentRefreshToken {
			t.Error("expected a new rotated refresh token")
		}

		// Verify old token is revoked
		var oldToken models.RefreshToken
		// Hashing logic inside usecase makes it hard to query by raw token here,
		// but we can check if there's any revoked token for this user.
		db.Where("user_id = ? AND is_revoked = ?", user.ID, true).First(&oldToken)
		if oldToken.TokenID == uuid.Nil {
			t.Error("expected old token to be revoked")
		}

		currentRefreshToken = newRefreshToken
	})

	t.Run("Individual Revocation", func(t *testing.T) {
		var token models.RefreshToken
		db.Where("user_id = ? AND is_revoked = ?", user.ID, false).First(&token)

		req := httptest.NewRequest(http.MethodDelete, "/api/v1/auth/refresh-tokens/"+token.TokenID.String(), nil)
		resp, _ := app.Test(req)

		if resp.StatusCode != http.StatusNoContent {
			t.Errorf("expected status 204, got %d", resp.StatusCode)
		}

		// Verify token is now revoked in DB
		db.First(&token, "token_id = ?", token.TokenID)
		if !token.IsRevoked {
			t.Error("expected token to be marked as revoked")
		}

		// Attempt to refresh with the revoked token (should fail 401)
		refreshReq := map[string]string{
			"refresh_token": currentRefreshToken,
		}
		body, _ := json.Marshal(refreshReq)
		reqRef := httptest.NewRequest(http.MethodPost, "/api/v1/auth/refresh", bytes.NewReader(body))
		reqRef.Header.Set("Content-Type", "application/json")

		respRef, _ := app.Test(reqRef)
		if respRef.StatusCode != http.StatusUnauthorized {
			t.Errorf("expected status 401 for revoked token, got %d", respRef.StatusCode)
		}
	})

	t.Run("Bulk Revocation", func(t *testing.T) {
		// 1. Get a new valid token first
		loginReq := map[string]string{
			"email":    "test@example.com",
			"password": "password123",
		}
		bodyL, _ := json.Marshal(loginReq)
		reqL := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(bodyL))
		reqL.Header.Set("Content-Type", "application/json")
		respL, _ := app.Test(reqL)

		var resL map[string]interface{}
		bodyBytesL, _ := io.ReadAll(respL.Body)
		json.Unmarshal(bodyBytesL, &resL)
		tokenToRevoke := resL["refresh_token"].(string)

		// 2. Call bulk revocation
		reqRev := httptest.NewRequest(http.MethodPost, "/api/v1/users/"+user.ID.String()+"/revoke-all-tokens", nil)
		respRev, _ := app.Test(reqRev)
		if respRev.StatusCode != http.StatusNoContent {
			t.Errorf("expected status 204, got %d", respRev.StatusCode)
		}

		// 3. Attempt refresh with the token (should fail)
		refreshReq := map[string]string{
			"refresh_token": tokenToRevoke,
		}
		bodyR, _ := json.Marshal(refreshReq)
		reqR := httptest.NewRequest(http.MethodPost, "/api/v1/auth/refresh", bytes.NewReader(bodyR))
		reqR.Header.Set("Content-Type", "application/json")

		respR, _ := app.Test(reqR)
		if respR.StatusCode != http.StatusUnauthorized {
			t.Errorf("expected status 401 after bulk revocation, got %d", respR.StatusCode)
		}
	})
}
