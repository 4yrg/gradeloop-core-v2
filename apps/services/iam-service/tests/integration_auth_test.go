package tests

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/application/usecases"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/http/handlers"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/notifications"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/repositories"
	_ "github.com/glebarez/sqlite"
	"github.com/gofiber/fiber/v3"
	"github.com/stretchr/testify/assert"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupAuthApp(t *testing.T) (*fiber.App, *gorm.DB) {
	// In-memory DB
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open db: %v", err)
	}
	if err := db.AutoMigrate(&models.User{}, &models.PasswordResetToken{}, &models.Role{}, &models.Permission{}, &models.AuditLog{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	userRepo := repositories.NewUserRepository(db)
	prRepo := repositories.NewPasswordResetRepository(db)
	notifier := notifications.NewNotificationStub()
	auth := usecases.NewAuthUsecase(userRepo, prRepo, notifier, "test-secret", 15*time.Minute, nil)
	authHandler := handlers.NewAuthHandler(auth)

	app := fiber.New()
	app.Post("/api/v1/auth/login", authHandler.Login)
	app.Post("/api/v1/auth/forgot-password", authHandler.ForgotPassword)
	app.Post("/api/v1/auth/reset-password", authHandler.ResetPassword)

	return app, db
}

func TestAuthIntegration_LoginAndReset(t *testing.T) {
	app, db := setupAuthApp(t)

	// Create user
	pwd := "OldPass!123"
	hash, _ := bcrypt.GenerateFromPassword([]byte(pwd), 12)
	u := &models.User{Email: "inttest@example.com", FullName: "Int Test", PasswordHash: string(hash), UserType: models.UserTypeEmployee, IsActive: true}
	if err := db.Create(u).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	// Successful login
	loginBody := map[string]string{"email": "inttest@example.com", "password": pwd}
	b, _ := json.Marshal(loginBody)
	req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	// Wrong password
	loginBody = map[string]string{"email": "inttest@example.com", "password": "wrong"}
	b, _ = json.Marshal(loginBody)
	req = httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	resp, err = app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusUnauthorized, resp.StatusCode)

	// Forgot password (existing email) -> should succeed and create token
	fpBody := map[string]string{"email": "inttest@example.com"}
	b, _ = json.Marshal(fpBody)
	req = httptest.NewRequest("POST", "/api/v1/auth/forgot-password", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	resp, err = app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	// Ensure a token exists in DB for user
	var pr models.PasswordResetToken
	if err := db.Where("user_id = ?", u.ID).First(&pr).Error; err != nil {
		t.Fatalf("expected password reset token in db: %v", err)
	}

	// Create a valid raw token ourselves for reset
	raw := "deadbeefcafebabe0123456789abcdef" // hex string
	h := sha256.Sum256([]byte(raw))
	hashHex := hex.EncodeToString(h[:])
	pr2 := &models.PasswordResetToken{UserID: u.ID, TokenHash: hashHex, ExpiresAt: time.Now().Add(30 * time.Minute)}
	if err := db.Create(pr2).Error; err != nil {
		t.Fatalf("create pr: %v", err)
	}

	// Reset password with valid token
	rpBody := map[string]string{"token": raw, "new_password": "NewStrong!456"}
	b, _ = json.Marshal(rpBody)
	req = httptest.NewRequest("POST", "/api/v1/auth/reset-password", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	resp, err = app.Test(req)
	assert.NoError(t, err)
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	// Ensure user's password updated
	var updated models.User
	if err := db.Where("email = ?", "inttest@example.com").First(&updated).Error; err != nil {
		t.Fatalf("fetch user: %v", err)
	}
	if err := bcrypt.CompareHashAndPassword([]byte(updated.PasswordHash), []byte("NewStrong!456")); err != nil {
		t.Fatalf("password was not updated: %v", err)
	}

	// Expired token case
	raw2 := "00ff11aa22bb33cc44dd55ee66ff7788"
	h2 := sha256.Sum256([]byte(raw2))
	hashHex2 := hex.EncodeToString(h2[:])
	pr3 := &models.PasswordResetToken{UserID: u.ID, TokenHash: hashHex2, ExpiresAt: time.Now().Add(-1 * time.Hour)}
	if err := db.Create(pr3).Error; err != nil {
		t.Fatalf("create expired pr: %v", err)
	}

	rpBody = map[string]string{"token": raw2, "new_password": "SomePass!789"}
	b, _ = json.Marshal(rpBody)
	req = httptest.NewRequest("POST", "/api/v1/auth/reset-password", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	resp, err = app.Test(req)
	assert.NoError(t, err)
	// Handler returns 400 for invalid/expired token
	assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)
}
