package usecases

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/application/ports"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/application/utils"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	gl_logger "github.com/4yrg/gradeloop-core-v2/shared/libs/go/logger"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type AuthUsecase struct {
	userRepo          ports.UserRepository
	refreshTokenRepo  ports.RefreshTokenRepository
	passwordResetRepo ports.PasswordResetRepository
	auditRepo         ports.AuditRepository
	notificationPort  ports.NotificationPort
	jwtSecret         string
	logger            *slog.Logger
}

func NewAuthUsecase(userRepo ports.UserRepository, refreshTokenRepo ports.RefreshTokenRepository, passwordResetRepo ports.PasswordResetRepository, auditRepo ports.AuditRepository, notificationPort ports.NotificationPort, jwtSecret string) *AuthUsecase {
	return &AuthUsecase{
		userRepo:          userRepo,
		refreshTokenRepo:  refreshTokenRepo,
		passwordResetRepo: passwordResetRepo,
		auditRepo:         auditRepo,
		notificationPort:  notificationPort,
		jwtSecret:         jwtSecret,
		logger:            gl_logger.New("iam-service"),
	}
}

// hashToken generates SHA256 hash of the raw token string
func (uc *AuthUsecase) hashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}

// Login authenticates a user and returns a raw access token, raw refresh token and user details
func (uc *AuthUsecase) Login(ctx context.Context, email, password string) (string, string, *models.User, error) {
	user, err := uc.userRepo.GetUserByEmail(email, false)
	if err != nil {
		return "", "", nil, errors.New("unauthorized: invalid credentials")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return "", "", nil, errors.New("unauthorized: invalid credentials")
	}

	if user.PasswordSetAt == nil {
		return "", "", nil, errors.New("unauthorized: account not activated")
	}

	// Fetch roles and permissions for the user
	roles, err := uc.userRepo.GetRolesByUserID(user.ID)
	if err != nil {
		return "", "", nil, fmt.Errorf("failed to fetch user roles: %w", err)
	}

	permissions, err := uc.userRepo.GetPermissionsByUserID(user.ID)
	if err != nil {
		return "", "", nil, fmt.Errorf("failed to fetch user permissions: %w", err)
	}

	// Issue Access Token (15m)
	accessToken, err := utils.GenerateAccessToken(user.ID, roles, permissions, uc.jwtSecret, 15*time.Minute)
	if err != nil {
		return "", "", nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	rawToken := uuid.New().String()
	tokenHash := uc.hashToken(rawToken)

	refreshToken := &models.RefreshToken{
		TokenID:    uuid.New(),
		TokenHash:  tokenHash,
		UserID:     user.ID,
		ExpiresAt:  time.Now().Add(30 * 24 * time.Hour),
		IsRevoked:  false,
		ActionType: "login",
	}

	if err := uc.refreshTokenRepo.Create(refreshToken); err != nil {
		return "", "", nil, err
	}

	uc.logAudit(ctx, "login", "user", user.ID.String(), nil, user)

	return accessToken, rawToken, user, nil
}

// Refresh validates the old token and issues a new rotated token
func (uc *AuthUsecase) Refresh(ctx context.Context, oldTokenStr string) (string, string, *models.User, error) {
	tokenHash := uc.hashToken(oldTokenStr)
	token, err := uc.refreshTokenRepo.GetByHash(tokenHash)
	if err != nil {
		// Log attempt with unknown token hash
		gl_logger.WithContext(ctx, uc.logger).Warn("Security event: attempt to refresh with non-matching hash or missing token", "token_hash", tokenHash)
		return "", "", nil, errors.New("unauthorized: invalid token")
	}

	// Security Event Logging for revoked or expired tokens
	if token.IsRevoked || token.ExpiresAt.Before(time.Now()) {
		gl_logger.WithContext(ctx, uc.logger).Warn("Security event: attempt to reuse revoked or expired token",
			"token_id", token.TokenID,
			"user_id", token.UserID,
			"is_revoked", token.IsRevoked,
			"is_expired", token.ExpiresAt.Before(time.Now()))
		return "", "", nil, errors.New("unauthorized: token is invalid")
	}

	user, err := uc.userRepo.GetUser(token.UserID, false)
	if err != nil {
		return "", "", nil, errors.New("unauthorized: user context lost")
	}

	// Revoke old token (Rotation)
	if err := uc.refreshTokenRepo.Revoke(token.TokenID); err != nil {
		return "", "", nil, err
	}

	// Fetch roles and permissions for the user
	roles, err := uc.userRepo.GetRolesByUserID(user.ID)
	if err != nil {
		return "", "", nil, fmt.Errorf("failed to fetch user roles: %w", err)
	}

	permissions, err := uc.userRepo.GetPermissionsByUserID(user.ID)
	if err != nil {
		return "", "", nil, fmt.Errorf("failed to fetch user permissions: %w", err)
	}

	// Issue new access token
	accessToken, err := utils.GenerateAccessToken(user.ID, roles, permissions, uc.jwtSecret, 15*time.Minute)
	if err != nil {
		return "", "", nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	// Issue new refresh token
	newRawToken := uuid.New().String()
	newTokenHash := uc.hashToken(newRawToken)

	newRefreshToken := &models.RefreshToken{
		TokenID:    uuid.New(),
		TokenHash:  newTokenHash,
		UserID:     user.ID,
		ExpiresAt:  time.Now().Add(30 * 24 * time.Hour),
		IsRevoked:  false,
		ActionType: "refresh",
	}

	if err := uc.refreshTokenRepo.Create(newRefreshToken); err != nil {
		return "", "", nil, err
	}

	return accessToken, newRawToken, user, nil
}

// RevokeToken performs individual revocation
func (uc *AuthUsecase) RevokeToken(ctx context.Context, tokenID uuid.UUID) error {
	if err := uc.refreshTokenRepo.Revoke(tokenID); err != nil {
		return err
	}
	uc.logAudit(ctx, "revoke", "refresh_token", tokenID.String(), nil, nil)
	return nil
}

// RevokeAllUserTokens performs bulk revocation for a specific user
func (uc *AuthUsecase) RevokeAllUserTokens(ctx context.Context, userID uuid.UUID) error {
	if err := uc.refreshTokenRepo.RevokeAllForUser(userID); err != nil {
		return err
	}
	uc.logAudit(ctx, "revoke_all", "user", userID.String(), nil, nil)
	return nil
}

// RequestActivation generates a new activation token, invalidates old ones, and sends an email.
func (uc *AuthUsecase) RequestActivation(ctx context.Context, email string) error {
	user, err := uc.userRepo.GetUserByEmail(email, false)
	if err != nil {
		// Generic success message to prevent user enumeration
		return nil
	}

	if user.PasswordSetAt != nil {
		return errors.New("account is already activated")
	}

	// Single-Use Enforcement: Generate a new token ID.
	newTokenID := uuid.New()
	user.ActivationTokenID = &newTokenID

	if err := uc.userRepo.UpdateActivationFields(user); err != nil {
		return err
	}

	token, err := utils.GenerateActivationToken(user.ID, newTokenID, uc.jwtSecret, 15*time.Minute)
	if err != nil {
		return err
	}

	activationLink := fmt.Sprintf("https://gradeloop.io/activate?token=%s", token)
	return uc.notificationPort.SendActivationLink(ctx, user.ID, user.Email, activationLink)
}

// ActivateAccount verifies the token and sets the user's initial password.
func (uc *AuthUsecase) ActivateAccount(ctx context.Context, tokenStr string, newPassword string) error {
	claims, err := utils.ValidateActivationToken(tokenStr, uc.jwtSecret)
	if err != nil {
		return fmt.Errorf("invalid or expired activation token: %w", err)
	}

	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		return errors.New("invalid token claims: subject is not a valid uuid")
	}

	tokenID, err := uuid.Parse(claims.ID)
	if err != nil {
		return errors.New("invalid token claims: jti is not a valid uuid")
	}

	user, err := uc.userRepo.GetUser(userID, false)
	if err != nil {
		return errors.New("user not found")
	}

	// Single-Use Enforcement: Verify that the token ID matches the one in the database.
	if user.ActivationTokenID == nil || *user.ActivationTokenID != tokenID {
		gl_logger.WithContext(ctx, uc.logger).Warn("Security event: attempt to reuse or use invalid activation token", "user_id", user.ID, "token_id", tokenID)
		return errors.New("forbidden: token has already been used or is invalid")
	}

	// Password Policy Enforcement
	if err := utils.ValidatePasswordPolicy(newPassword); err != nil {
		return err
	}

	// Hash new password
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), 12)
	if err != nil {
		return err
	}

	now := time.Now()
	user.PasswordHash = string(hash)
	user.PasswordSetAt = &now
	user.ActivationTokenID = nil        // Invalidate token
	user.IsPasswordResetRequired = true // Requirement: Forced Password Reset Flow

	if err := uc.userRepo.UpdateActivationFields(user); err != nil {
		return err
	}

	uc.logAudit(ctx, "activate", "user", user.ID.String(), nil, user)

	return nil
}

func (uc *AuthUsecase) logAudit(ctx context.Context, action, entity, entityID string, oldValue, newValue interface{}) {
	auditLog := utils.PrepareAuditLog(ctx, action, entity, entityID, oldValue, newValue)
	_ = uc.auditRepo.CreateAuditLog(ctx, auditLog)
}

// GetJWTSecret returns the JWT secret for token validation
func (uc *AuthUsecase) GetJWTSecret() string {
	return uc.jwtSecret
}

// GetUserByID retrieves a user by ID for validation purposes
func (uc *AuthUsecase) GetUserByID(ctx context.Context, userID uuid.UUID) (*models.User, error) {
	return uc.userRepo.GetUser(userID, false)
}

// ForgotPassword initiates the password reset process by generating a secure token and sending reset email.
// Implements rate limiting and anti-enumeration protection.
func (uc *AuthUsecase) ForgotPassword(ctx context.Context, email string) error {
	user, err := uc.userRepo.GetUserByEmail(email, false)
	if err != nil {
		// Anti-enumeration: Return success even if user doesn't exist
		uc.logger.Info("Password reset requested for non-existent email", "email", email)
		return nil
	}

	// Check if user already has too many active reset tokens (rate limiting)
	activeTokens, err := uc.passwordResetRepo.CountActiveTokensForUser(ctx, user.ID)
	if err != nil {
		return fmt.Errorf("failed to check existing tokens: %w", err)
	}

	if activeTokens >= 3 { // Maximum 3 active tokens per user
		uc.logger.Warn("Password reset rate limit exceeded", "user_id", user.ID, "email", email)
		return errors.New("too many password reset requests. Please wait before requesting another reset")
	}

	// Generate secure token
	tokenID := uuid.New()
	rawToken := uuid.New().String()
	tokenHash := uc.hashToken(rawToken)

	// Create password reset token (valid for 15 minutes)
	resetToken := &models.PasswordResetToken{
		ID:        tokenID,
		TokenHash: tokenHash,
		UserID:    user.ID,
		ExpiresAt: time.Now().Add(15 * time.Minute),
		IsUsed:    false,
	}

	if err := uc.passwordResetRepo.Create(ctx, resetToken); err != nil {
		return fmt.Errorf("failed to create reset token: %w", err)
	}

	// Generate JWT for the reset link
	jwtToken, err := utils.GeneratePasswordResetToken(user.ID, tokenID, uc.jwtSecret, 15*time.Minute)
	if err != nil {
		return fmt.Errorf("failed to generate JWT token: %w", err)
	}

	// Send reset email
	resetLink := fmt.Sprintf("https://gradeloop.io/reset-password?token=%s", jwtToken)
	if err := uc.notificationPort.SendPasswordResetLink(ctx, user.ID, user.Email, resetLink); err != nil {
		uc.logger.Error("Failed to send password reset email", "user_id", user.ID, "email", email, "error", err)
		// Don't return error to prevent enumeration
	}

	uc.logAudit(ctx, "password_reset_requested", "user", user.ID.String(), nil, map[string]interface{}{
		"email":    email,
		"token_id": tokenID,
	})

	return nil
}

// ResetPassword validates the reset token and updates the user's password.
// Implements single-use token enforcement and secure password validation.
func (uc *AuthUsecase) ResetPassword(ctx context.Context, tokenStr string, newPassword string) error {
	// Validate JWT token
	claims, err := utils.ValidatePasswordResetToken(tokenStr, uc.jwtSecret)
	if err != nil {
		return fmt.Errorf("invalid or expired reset token: %w", err)
	}

	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		return errors.New("invalid token claims: subject is not a valid uuid")
	}

	tokenID, err := uuid.Parse(claims.TokenID)
	if err != nil {
		return errors.New("invalid token claims: token_id is not a valid uuid")
	}

	// Get user
	user, err := uc.userRepo.GetUser(userID, false)
	if err != nil {
		return errors.New("user not found")
	}

	// Verify token exists and is valid
	tokenHash := uc.hashToken(tokenStr)
	resetToken, err := uc.passwordResetRepo.GetByTokenHash(ctx, tokenHash)
	if err != nil {
		uc.logger.Warn("Invalid password reset token used", "user_id", userID, "token_id", tokenID)
		return errors.New("invalid or expired reset token")
	}

	// Verify token ID matches
	if resetToken.ID != tokenID {
		uc.logger.Warn("Token ID mismatch in password reset", "user_id", userID, "expected", tokenID, "actual", resetToken.ID)
		return errors.New("invalid reset token")
	}

	// Check if token is valid (not used, not expired)
	if !resetToken.IsValid() {
		uc.logger.Warn("Attempt to reuse password reset token", "user_id", userID, "token_id", tokenID, "is_used", resetToken.IsUsed, "is_expired", resetToken.IsExpired())
		return errors.New("reset token has expired or already been used")
	}

	// Validate password policy
	if err := utils.ValidatePasswordPolicy(newPassword); err != nil {
		return fmt.Errorf("password policy violation: %w", err)
	}

	// Hash new password
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), 12)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// Update user password
	now := time.Now()
	user.PasswordHash = string(hash)
	user.PasswordChangedAt = &now
	user.IsPasswordResetRequired = false // Password was actively changed

	if err := uc.userRepo.UpdateActivationFields(user); err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}

	// Mark token as used
	if err := uc.passwordResetRepo.MarkAsUsed(ctx, tokenID); err != nil {
		uc.logger.Error("Failed to mark reset token as used", "token_id", tokenID, "error", err)
		// Continue - password was already updated
	}

	// Invalidate all other reset tokens for this user
	if err := uc.passwordResetRepo.InvalidateAllForUser(ctx, userID); err != nil {
		uc.logger.Error("Failed to invalidate other reset tokens", "user_id", userID, "error", err)
		// Continue - main operation succeeded
	}

	// Revoke all refresh tokens to force re-login
	if err := uc.refreshTokenRepo.RevokeAllForUser(userID); err != nil {
		uc.logger.Error("Failed to revoke refresh tokens after password reset", "user_id", userID, "error", err)
		// Continue - main operation succeeded
	}

	uc.logAudit(ctx, "password_reset_completed", "user", user.ID.String(), nil, map[string]interface{}{
		"token_id": tokenID,
		"email":    user.Email,
	})

	return nil
}

// ChangePassword allows authenticated users to change their password.
// Requires current password verification for security.
func (uc *AuthUsecase) ChangePassword(ctx context.Context, userID uuid.UUID, currentPassword, newPassword string) error {
	user, err := uc.userRepo.GetUser(userID, false)
	if err != nil {
		return errors.New("user not found")
	}

	// Verify current password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(currentPassword)); err != nil {
		return errors.New("current password is incorrect")
	}

	// Validate new password policy
	if err := utils.ValidatePasswordPolicy(newPassword); err != nil {
		return fmt.Errorf("password policy violation: %w", err)
	}

	// Check if new password is different from current
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(newPassword)); err == nil {
		return errors.New("new password must be different from current password")
	}

	// Hash new password
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), 12)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// Update user password
	now := time.Now()
	user.PasswordHash = string(hash)
	user.PasswordChangedAt = &now
	user.IsPasswordResetRequired = false

	if err := uc.userRepo.UpdateActivationFields(user); err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}

	// Revoke all refresh tokens to force re-login on other devices
	if err := uc.refreshTokenRepo.RevokeAllForUser(userID); err != nil {
		uc.logger.Error("Failed to revoke refresh tokens after password change", "user_id", userID, "error", err)
		// Continue - main operation succeeded
	}

	uc.logAudit(ctx, "password_changed", "user", user.ID.String(), nil, map[string]interface{}{
		"email": user.Email,
	})

	return nil
}
