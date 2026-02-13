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

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/application/usecases"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/http/handlers"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/http/router"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/notifications"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/repositories"
	"github.com/gofiber/fiber/v3"
	"github.com/redis/go-redis/v9"
	miniredis "github.com/alicebob/miniredis/v2"
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

	// Redis - use real REDIS_ADDR when provided, otherwise spawn an in-memory miniredis for tests
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		mr, err := miniredis.Run()
		if err != nil {
			t.Fatalf("failed to start miniredis: %v", err)
		}
		// Use the in-memory server address
		redisAddr = mr.Addr()
		// Note: mr will live for the duration of the test process; it's fine to not explicitly stop it here
	}
	redisClient := redis.NewClient(&redis.Options{Addr: redisAddr})
	// Flush Redis to ensure a clean state for the test
	redisClient.FlushAll(context.Background())

	// Repositories
	userRepo := repositories.NewUserRepository(db)
	refreshTokenRepo := repositories.NewRefreshTokenRepository(db)
	auditRepo := &MockAuditRepository{}
	notificationStub := notifications.NewNotificationStub()
	passwordResetRepo := repositories.NewPasswordResetRepository(db)

	// Usecases
	authUsecase := usecases.NewAuthUsecase(userRepo, refreshTokenRepo, passwordResetRepo, auditRepo, notificationStub, "test-secret")
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

func createTestUser(db *gorm.DB, email string, password string) *models.User {
	hash, _ := bcrypt.GenerateFromPassword([]byte(password), 12)
	now := time.Now()
	user := &models.User{
		Email:         email,
		FullName:      "Test User",
		PasswordHash:  string(hash),
		UserType:      models.UserTypeEmployee,
		IsActive:      true,
		PasswordSetAt: &now,
	}
	db.Create(user)
	return user
}

// TestBruteForceProtection_BasicLockout tests that account is locked after 5 failed attempts
func TestBruteForceProtection_BasicLockout(t *testing.T) {
	app, db, _ := setupBruteForceTestApp(t)

	user := createTestUser(db, "bruteforce@test.com", "password123")

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
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode, "Attempt %d should return 401", i+1)
	}

	// 6th attempt should be blocked
	req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(req)
	assert.Equal(t, http.StatusTooManyRequests, resp.StatusCode, "6th attempt should return 429")

	// Verify error message
	var response map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&response)
	assert.Equal(t, "Account temporarily locked", response["error"])
}

// TestBruteForceProtection_AutoExpiration tests that lockout expires after 15 minutes
func TestBruteForceProtection_AutoExpiration(t *testing.T) {
	app, db, redisClient := setupBruteForceTestApp(t)

	user := createTestUser(db, "expiration@test.com", "password123")

	loginReq := map[string]string{
		"email":    user.Email,
		"password": "wrong-password",
	}
	body, _ := json.Marshal(loginReq)

	// Make 5 failed attempts to trigger lockout
	for i := 0; i < 5; i++ {
		req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		app.Test(req)
	}

	// Verify account is locked
	req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(req)
	assert.Equal(t, http.StatusTooManyRequests, resp.StatusCode, "Account should be locked")

	// Simulate expiration by manually deleting the Redis key
	// In a real scenario, we would wait 15 minutes or use a time-mocking library
	key := "auth_fail:0.0.0.0:" + user.Email
	redisClient.Del(context.Background(), key)

	// Now login should be allowed again (though still with wrong password)
	req = httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, _ = app.Test(req)
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode, "After expiration, should return 401 for wrong password, not 429")

	// Verify TTL is set correctly (before we deleted it)
	// Re-trigger lockout to check TTL
	for i := 0; i < 5; i++ {
		req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		app.Test(req)
	}

	ttl := redisClient.TTL(context.Background(), key).Val()
	assert.Greater(t, ttl.Seconds(), float64(0), "TTL should be set")
	assert.LessOrEqual(t, ttl.Seconds(), float64(15*60), "TTL should be <= 15 minutes")
}

// TestBruteForceProtection_SuccessfulLoginResetsCounter tests that successful login resets the failure counter
func TestBruteForceProtection_SuccessfulLoginResetsCounter(t *testing.T) {
	app, db, redisClient := setupBruteForceTestApp(t)

	password := "password123"
	user := createTestUser(db, "reset@test.com", password)

	// Make 3 failed attempts
	wrongLoginReq := map[string]string{
		"email":    user.Email,
		"password": "wrong-password",
	}
	wrongBody, _ := json.Marshal(wrongLoginReq)

	for i := 0; i < 3; i++ {
		req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(wrongBody))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	}

	// Verify counter is at 3
	key := "auth_fail:0.0.0.0:" + user.Email
	attempts, _ := redisClient.Get(context.Background(), key).Int64()
	assert.Equal(t, int64(3), attempts, "Counter should be at 3")

	// Make a successful login
	correctLoginReq := map[string]string{
		"email":    user.Email,
		"password": password,
	}
	correctBody, _ := json.Marshal(correctLoginReq)

	req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(correctBody))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(req)
	assert.Equal(t, http.StatusOK, resp.StatusCode, "Correct password should succeed")

	// Verify counter is reset (key should be deleted)
	exists := redisClient.Exists(context.Background(), key).Val()
	assert.Equal(t, int64(0), exists, "Counter should be reset after successful login")

	// Make 4 more failed attempts - should not lock because counter was reset
	for i := 0; i < 4; i++ {
		req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(wrongBody))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode, "Should return 401, not 429")
	}
}

// TestBruteForceProtection_RedisFailureDegradedMode tests that authentication proceeds when Redis is unavailable
func TestBruteForceProtection_RedisFailureDegradedMode(t *testing.T) {
	t.Setenv("GO_ENV", "test")

	// Database
	db, _ := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	db.AutoMigrate(&models.User{}, &models.RefreshToken{})

	// NOTE: This test verifies that authentication works without Redis dependency.
	// In production, brute-force protection middleware would handle Redis failures gracefully.

	// Repositories
	userRepo := repositories.NewUserRepository(db)
	refreshTokenRepo := repositories.NewRefreshTokenRepository(db)
	auditRepo := &MockAuditRepository{}
	notificationStub := notifications.NewNotificationStub()
	passwordResetRepo := repositories.NewPasswordResetRepository(db)

	// Usecases
	authUsecase := usecases.NewAuthUsecase(userRepo, refreshTokenRepo, passwordResetRepo, auditRepo, notificationStub, "test-secret")
	userUsecase := usecases.NewUserUsecase(userRepo, auditRepo)
	roleUsecase := &usecases.RoleUsecase{}
	permissionUsecase := &usecases.PermissionUsecase{}

	// Handlers
	authHandler := handlers.NewAuthHandler(authUsecase)
	userHandler := handlers.NewUserHandler(userUsecase)
	roleHandler := handlers.NewRoleHandler(roleUsecase)
	permissionHandler := handlers.NewPermissionHandler(permissionUsecase)

	app := fiber.New()
	router.Setup(app, userHandler, roleHandler, permissionHandler, authHandler, nil, auditRepo)

	// Create test user
	password := "password123"
	user := createTestUser(db, "degraded@test.com", password)

	// Attempt login with wrong password - should still return 401, not fail completely
	wrongLoginReq := map[string]string{
		"email":    user.Email,
		"password": "wrong-password",
	}
	wrongBody, _ := json.Marshal(wrongLoginReq)

	req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(wrongBody))
	req.Header.Set("Content-Type", "application/json")
	resp, _ := app.Test(req)
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode, "Should return 401 in degraded mode, not error")

	// Attempt login with correct password - should succeed
	correctLoginReq := map[string]string{
		"email":    user.Email,
		"password": password,
	}
	correctBody, _ := json.Marshal(correctLoginReq)

	req = httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(correctBody))
	req.Header.Set("Content-Type", "application/json")
	resp, _ = app.Test(req)
	assert.Equal(t, http.StatusOK, resp.StatusCode, "Should succeed in degraded mode")

	// Make multiple failed attempts - should NOT lock out in degraded mode
	for i := 0; i < 10; i++ {
		req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(wrongBody))
		req.Header.Set("Content-Type", "application/json")
		resp, _ := app.Test(req)
		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode, "Should return 401, never 429 in degraded mode")
	}
}

// TestBruteForceProtection_AntiEnumeration tests that error messages don't reveal user existence
func TestBruteForceProtection_AntiEnumeration(t *testing.T) {
	app, db, _ := setupBruteForceTestApp(t)

	// Create a real user
	realUser := createTestUser(db, "real@test.com", "password123")

	// Test with real user - trigger lockout
	realLoginReq := map[string]string{
		"email":    realUser.Email,
		"password": "wrong-password",
	}
	realBody, _ := json.Marshal(realLoginReq)

	for i := 0; i < 5; i++ {
		req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(realBody))
		req.Header.Set("Content-Type", "application/json")
		app.Test(req)
	}

	req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(realBody))
	req.Header.Set("Content-Type", "application/json")
	respReal, _ := app.Test(req)

	var realResponse map[string]interface{}
	json.NewDecoder(respReal.Body).Decode(&realResponse)

	// Test with non-existent user - trigger lockout
	fakeLoginReq := map[string]string{
		"email":    "nonexistent@test.com",
		"password": "wrong-password",
	}
	fakeBody, _ := json.Marshal(fakeLoginReq)

	for i := 0; i < 5; i++ {
		req := httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(fakeBody))
		req.Header.Set("Content-Type", "application/json")
		app.Test(req)
	}

	req = httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(fakeBody))
	req.Header.Set("Content-Type", "application/json")
	respFake, _ := app.Test(req)

	var fakeResponse map[string]interface{}
	json.NewDecoder(respFake.Body).Decode(&fakeResponse)

	// Both should return same status code
	assert.Equal(t, respReal.StatusCode, respFake.StatusCode, "Status codes should be identical")

	// Both should return same error message
	assert.Equal(t, realResponse["error"], fakeResponse["error"], "Error messages should be identical")
	assert.Equal(t, "Account temporarily locked", realResponse["error"], "Should use standardized message")

	// Verify response timing is similar (anti-timing attack)
	// This is a basic check - in production, you'd want more sophisticated timing analysis
	start := time.Now()
	req = httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(realBody))
	req.Header.Set("Content-Type", "application/json")
	app.Test(req)
	realDuration := time.Since(start)

	start = time.Now()
	req = httptest.NewRequest("POST", "/api/v1/auth/login", bytes.NewReader(fakeBody))
	req.Header.Set("Content-Type", "application/json")
	app.Test(req)
	fakeDuration := time.Since(start)

	// Response times should be within reasonable range (< 100ms difference)
	timeDiff := realDuration - fakeDuration
	if timeDiff < 0 {
		timeDiff = -timeDiff
	}
	assert.Less(t, timeDiff.Milliseconds(), int64(100), "Response times should be similar to prevent timing attacks")
}
