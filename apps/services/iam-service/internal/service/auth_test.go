package service_test

import (
	"context"
	// "errors"
	"testing"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/dto"
	repoMocks "github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/repository/mocks"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/service"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/utils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestAuthService_Login(t *testing.T) {
	mockUserRepo := new(repoMocks.UserRepository)
	mockTokenRepo := new(repoMocks.RefreshTokenRepository)
	mockPasswdRepo := new(repoMocks.PasswordResetRepository) // Assuming this mock exists
	mockAuditRepo := new(repoMocks.AuditRepository)

	// Set secret for JWT
	// os.Setenv("SECRET", "testsecret") // Ideally handled via config/test setup

	authService := service.NewAuthService(mockUserRepo, mockTokenRepo, mockPasswdRepo, mockAuditRepo)

	t.Run("Success", func(t *testing.T) {
		password := "password123"
		hashedPassword, _ := utils.HashPassword(password)

		user := &domain.User{
			ID:           "user-123",
			Email:        "test@example.com",
			PasswordHash: hashedPassword,
			IsActive:     true,
		}

		req := dto.LoginRequest{
			Email:    "test@example.com",
			Password: password,
		}

		mockUserRepo.On("FindByEmail", mock.Anything, "test@example.com").Return(user, nil)

		// Expect token creation
		mockTokenRepo.On("Create", mock.Anything, mock.Anything).Return(nil)

		res, err := authService.Login(context.Background(), req, "127.0.0.1", "TestAgent")

		assert.NoError(t, err)
		assert.NotNil(t, res)
		assert.NotEmpty(t, res.AccessToken)
		assert.NotEmpty(t, res.RefreshToken)
	})

	t.Run("InvalidPassword", func(t *testing.T) {
		// ... (Similar setup with wrong password)
		password := "password123"
		hashedPassword, _ := utils.HashPassword(password)

		user := &domain.User{
			ID:           "user-123",
			Email:        "test@example.com",
			PasswordHash: hashedPassword,
			IsActive:     true,
		}
		req := dto.LoginRequest{
			Email:    "test@example.com",
			Password: "wrongpassword",
		}
		mockUserRepo.On("FindByEmail", mock.Anything, "test@example.com").Return(user, nil)

		res, err := authService.Login(context.Background(), req, "127.0.0.1", "TestAgent")
		assert.Error(t, err)
		assert.Nil(t, res)
	})
}

func TestAuthService_RequestPasswordReset(t *testing.T) {
	mockUserRepo := new(repoMocks.UserRepository)
	mockTokenRepo := new(repoMocks.RefreshTokenRepository)
	mockPasswdRepo := new(repoMocks.PasswordResetRepository)
	mockAuditRepo := new(repoMocks.AuditRepository)

	authService := service.NewAuthService(mockUserRepo, mockTokenRepo, mockPasswdRepo, mockAuditRepo)

	t.Run("Success", func(t *testing.T) {
		user := &domain.User{
			ID:    "user-123",
			Email: "reset@example.com",
		}

		mockUserRepo.On("FindByEmail", mock.Anything, "reset@example.com").Return(user, nil)
		mockPasswdRepo.On("Create", mock.Anything, mock.MatchedBy(func(p *domain.PasswordResetToken) bool {
			return p.UserID == "user-123" && p.ExpiresAt.After(time.Now())
		})).Return(nil)
		mockAuditRepo.On("Create", mock.Anything, mock.Anything).Return(nil)

		token, err := authService.RequestPasswordReset(context.Background(), "reset@example.com")

		assert.NoError(t, err)
		assert.NotEmpty(t, token)
	})
}
