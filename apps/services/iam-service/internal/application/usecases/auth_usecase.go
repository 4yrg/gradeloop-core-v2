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
	userRepo         ports.UserRepository
	refreshTokenRepo ports.RefreshTokenRepository
	auditRepo        ports.AuditRepository
	notificationPort ports.NotificationPort
	jwtSecret        string
	logger           *slog.Logger
}

func NewAuthUsecase(userRepo ports.UserRepository, refreshTokenRepo ports.RefreshTokenRepository, auditRepo ports.AuditRepository, notificationPort ports.NotificationPort, jwtSecret string) *AuthUsecase {
	return &AuthUsecase{
		userRepo:         userRepo,
		refreshTokenRepo: refreshTokenRepo,
		auditRepo:        auditRepo,
		notificationPort: notificationPort,
		jwtSecret:        jwtSecret,
		logger:           gl_logger.New("iam-service"),
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
