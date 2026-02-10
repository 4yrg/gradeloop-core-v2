package tests

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/application/usecases"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/http/handlers"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/http/router"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/notifications"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/repositories"
	"github.com/go-redis/redis/v8"
	"github.com/gofiber/fiber/v3"
	"github.com/stretchr/testify/assert"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type MockAuditRepository struct{}

func (m *MockAuditRepository) CreateAuditLog(ctx context.Context, log *models.AuditLog) error {
	return nil
}

func setupBruteForceTestApp(t *testing.T) (*fiber.App, *gorm.DB, *redis.Client) {
	t.Setenv("GO_ENV", "test")

	// Database
	db, _ := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	db.AutoMigrate(&models.User{}, &models.RefreshToken{})

	// Redis
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}
	redisClient := redis.NewClient(&redis.Options{Addr: redisAddr})
	// Flush Redis to ensure a clean state for the test
	redisClient.FlushAll(context.Background())

	// Repositories
	userRepo := repositories.NewUserRepository(db)
	refreshTokenRepo := repositories.NewRefreshTokenRepository(db)
	auditRepo := &MockAuditRepository{}
	notificationStub := notifications.NewNotificationStub()

	// Usecases
	authUsecase := usecases.NewAuthUsecase(userRepo, refreshTokenRepo, auditRepo, notificationStub, "test-secret")
	userUsecase := usecases.NewUserUsecase(userRepo, auditRepo)
	roleUsecase := &usecases.RoleUsecase{}
	permissionUsecase := &usecases.PermissionUsecase{}

	// Handlers
	authHandler := handlers.NewAuthHandler(authUsecase)
	userHandler := handlers.NewUserHandler(userUsecase)
	roleHandler := handlers.NewRoleHandler(roleUsecase)
	permissionHandler := handlers.NewPermissionHandler(permissionUsecase)

	app := fiber.New()
	router.Setup(app, userHandler, roleHandler, permissionHandler, authHandler, redisClient, auditRepo)

	return app, db, redisClient
}

func TestBruteForceProtection(t *testing.T) {
	app, db, _ := setupBruteForceTestApp(t)

	// Create a test user
	password := "password123"
	hash, _ := bcrypt.GenerateFromPassword([]byte(password), 12)
	now := time.Now()
	user := &models.User{
		Email:         "bruteforce@test.com",
		FullName:      "Brute Force User",
		PasswordHash:  string(hash),
		UserType:      models.UserTypeEmployee,
		IsActive:      true,
		PasswordSetAt: &now,
	}
	db.Create(user)

	loginReq := map[string]string{
		"email":    user.Email,
		"password": "wrong-password",
	}
	body, _ := json.Marshal(loginReq)

	// 5 failed attempts
	for i := 0; i < 5; i++ {
		req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	}

	// 6th attempt should be blocked
	req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(req)
	assert.Equal(t, http.StatusTooManyRequests, resp.StatusCode)

	// TODO: Test that the lockout expires after 15 minutes.
	// This would require mocking time or waiting for 15 minutes.
	// For now, we will just test the successful login after the lockout period is over
	// by manually deleting the key. A better approach would be to use a time mocking library.
}
