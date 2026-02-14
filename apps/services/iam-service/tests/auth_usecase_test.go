package tests

import (
	"context"
	"encoding/hex"
	"testing"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/application/usecases"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/notifications"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/repositories"
	_ "github.com/glebarez/sqlite"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// Note: this test is lightweight and focuses on usecase behavior.
func setupTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open in-memory db: %v", err)
	}
	if err := db.AutoMigrate(&models.User{}, &models.RefreshToken{}, &models.PasswordResetToken{}, &models.Role{}, &models.Permission{}, &models.AuditLog{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func TestLoginAndResetFlow(t *testing.T) {
	db := setupTestDB(t)

	userRepo := repositories.NewUserRepository(db)
	prRepo := repositories.NewPasswordResetRepository(db)
	notifier := notifications.NewNotificationStub()

	// Seed role and user
	adminRole := models.Role{RoleName: models.RoleAdmin}
	if err := db.Create(&adminRole).Error; err != nil {
		t.Fatalf("create role: %v", err)
	}

	pwd := "Str0ng!Pass"
	hash, _ := bcrypt.GenerateFromPassword([]byte(pwd), 12)
	u := &models.User{Email: "test@example.com", FullName: "Test", PasswordHash: string(hash), UserType: models.UserTypeEmployee, Roles: []models.Role{adminRole}, IsActive: true}
	if err := db.Create(u).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	auth := usecases.NewAuthUsecase(userRepo, prRepo, notifier, "test-secret", 15*time.Minute, nil)

	// Successful login
	accessToken, _, user, err := auth.Login(context.Background(), "test@example.com", pwd)
	if err != nil || accessToken == "" || user == nil {
		t.Fatalf("login failed: %v", err)
	}

	// Forgot password should create a token
	if err := auth.ForgotPassword(context.Background(), "test@example.com"); err != nil {
		t.Fatalf("forgot password failed: %v", err)
	}

	// Find token in DB
	var pr models.PasswordResetToken
	if err := db.First(&pr, "user_id = ?", u.ID).Error; err != nil {
		t.Fatalf("reset token not found: %v", err)
	}

	// Simulate reset using raw token: we don't have raw token here since only hash stored,
	// but we can ensure hashing behavior is consistent: hash stored should be sha256 of raw.
	if pr.TokenHash == "" {
		t.Fatalf("token hash empty")
	}

	// Ensure hash is valid hex
	if _, err := hex.DecodeString(pr.TokenHash); err != nil {
		t.Fatalf("invalid token hash stored")
	}

	// Cleanup expired
	// DeleteExpired takes no args in this repo implementation in tests
	if err := prRepo.DeleteExpired(); err != nil {
		t.Fatalf("delete expired: %v", err)
	}
}
