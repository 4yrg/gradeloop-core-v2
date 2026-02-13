package usecases

import (
	"context"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"github.com/google/uuid"
)

type AuthUsecase interface {
	// Login handles user authentication and returns tokens
	Login(ctx context.Context, email, password string) (accessToken string, refreshToken string, user *models.User, err error)

	// Refresh handles token refresh with rotation
	Refresh(ctx context.Context, refreshToken string) (newAccessToken string, newRefreshToken string, user *models.User, err error)

	// RevokeToken revokes a specific refresh token
	RevokeToken(ctx context.Context, tokenID uuid.UUID) error

	// RevokeAllUserTokens revokes all refresh tokens for a user
	RevokeAllUserTokens(ctx context.Context, userID uuid.UUID) error

	// ActivateAccount activates a user account with a password
	ActivateAccount(ctx context.Context, token, password string) error

	// RequestActivation sends activation request
	RequestActivation(ctx context.Context, email string) error

	// ForgotPassword initiates password reset process
	ForgotPassword(ctx context.Context, email string) error

	// ResetPassword completes password reset process
	ResetPassword(ctx context.Context, token, newPassword string) error

	// ValidateToken validates an access token
	ValidateToken(ctx context.Context, token string) (*models.User, error)

	// ChangePassword allows user to change their password
	ChangePassword(ctx context.Context, userID uuid.UUID, currentPassword, newPassword string) error

	// Logout handles user logout
	Logout(ctx context.Context, userID uuid.UUID) error
}