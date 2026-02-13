package usecases

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/application/ports"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/application/utils"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type authUsecase struct {
	userRepo         ports.UserRepository
	passwordResetRepo ports.PasswordResetRepository
	notificationPort ports.NotificationPort
	jwtSecret        string
	jwtExpiry        time.Duration
	auditRepo        ports.AuditRepository
}

func NewAuthUsecase(
	userRepo ports.UserRepository,
	passwordResetRepo ports.PasswordResetRepository,
	notificationPort ports.NotificationPort,
	jwtSecret string,
	jwtExpiry time.Duration,
	auditRepo ports.AuditRepository,
) AuthUsecase {
	return &authUsecase{
		userRepo:         userRepo,
		passwordResetRepo: passwordResetRepo,
		notificationPort:  notificationPort,
		jwtSecret:        jwtSecret,
		jwtExpiry:        jwtExpiry,
		auditRepo:        auditRepo,
	}
}

func (a *authUsecase) Login(ctx context.Context, email, password string) (string, string, *models.User, error) {
	if email == "" || password == "" {
		return "", "", nil, errors.New("email and password are required")
	}

	user, err := a.userRepo.GetUserByEmail(email, false)
	if err != nil {
		// To prevent user enumeration, return the same error regardless of whether user exists
		return "", "", nil, errors.New("invalid credentials")
	}

	if !user.IsActive {
		return "", "", nil, errors.New("account is deactivated")
	}

	if user.IsPasswordResetRequired {
		return "", "", nil, errors.New("password reset required")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		if a.auditRepo != nil {
			_ = a.auditRepo.CreateAuditLog(ctx, &models.AuditLog{
				Action:   "failed_login_attempt",
				Entity:   "users",
				EntityID: user.Email,
				UserID:   &user.ID,
			})
		}
		return "", "", nil, errors.New("invalid credentials")
	}

	// Get user roles and permissions
	roles, err := a.userRepo.GetRolesByUserID(user.ID)
	if err != nil {
		return "", "", nil, fmt.Errorf("failed to get user roles: %w", err)
	}

	permissions, err := a.userRepo.GetPermissionsByUserID(user.ID)
	if err != nil {
		return "", "", nil, fmt.Errorf("failed to get user permissions: %w", err)
	}

	// Generate access token (short-lived)
	accessToken, err := utils.GenerateAccessToken(user.ID, roles, permissions, a.jwtSecret, a.jwtExpiry)
	if err != nil {
		return "", "", nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	// Generate refresh token (longer-lived with rotation)
	refreshToken, err := a.generateRefreshToken()
	if err != nil {
		return "", "", nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	// Store refresh token in database with user association
	refreshTokenRecord := &models.RefreshToken{
		Token:     refreshToken,
		UserID:    user.ID,
		Expiry:    time.Now().Add(30 * 24 * time.Hour), // 30 days
		IsActive:  true,
		IsUsed:    false,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := a.userRepo.StoreRefreshToken(ctx, refreshTokenRecord); err != nil {
		return "", "", nil, fmt.Errorf("failed to store refresh token: %w", err)
	}

	// Audit successful login
	if a.auditRepo != nil {
		_ = a.auditRepo.CreateAuditLog(ctx, &models.AuditLog{
			Action:   "successful_login",
			Entity:   "users",
			EntityID: user.Email,
			UserID:   &user.ID,
		})
	}

	// Don't expose password hash in response
	user.PasswordHash = ""

	return accessToken, refreshToken, user, nil
}

func (a *authUsecase) Refresh(ctx context.Context, refreshToken string) (string, string, *models.User, error) {
	if refreshToken == "" {
		return "", "", nil, errors.New("refresh token is required")
	}

	// Get refresh token record from database
	tokenRecord, err := a.userRepo.GetRefreshToken(refreshToken)
	if err != nil {
		return "", "", nil, errors.New("invalid refresh token")
	}

	// Check if token is active and not expired
	if !tokenRecord.IsActive || time.Now().After(tokenRecord.Expiry) {
		// Invalidate the token if it's expired
		a.userRepo.InvalidateRefreshToken(refreshToken)
		return "", "", nil, errors.New("refresh token expired or inactive")
	}

	// Check if this token has been used before (replay attack detection)
	if tokenRecord.IsUsed {
		// This might indicate a stolen token - revoke all user tokens
		_ = a.RevokeAllUserTokens(ctx, tokenRecord.UserID)
		return "", "", nil, errors.New("potential security breach detected - please log in again")
	}

	// Mark current token as used
	if err := a.userRepo.MarkRefreshTokenAsUsed(refreshToken); err != nil {
		return "", "", nil, fmt.Errorf("failed to mark refresh token as used: %w", err)
	}

	// Get user associated with this token
	user, err := a.userRepo.GetUser(tokenRecord.UserID, false)
	if err != nil {
		return "", "", nil, fmt.Errorf("user not found: %w", err)
	}

	if !user.IsActive {
		return "", "", nil, errors.New("account is deactivated")
	}

	// Get user roles and permissions
	roles, err := a.userRepo.GetRolesByUserID(user.ID)
	if err != nil {
		return "", "", nil, fmt.Errorf("failed to get user roles: %w", err)
	}

	permissions, err := a.userRepo.GetPermissionsByUserID(user.ID)
	if err != nil {
		return "", "", nil, fmt.Errorf("failed to get user permissions: %w", err)
	}

	// Generate new access token
	newAccessToken, err := utils.GenerateAccessToken(user.ID, roles, permissions, a.jwtSecret, a.jwtExpiry)
	if err != nil {
		return "", "", nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	// Generate new refresh token (rotation)
	newRefreshToken, err := a.generateRefreshToken()
	if err != nil {
		return "", "", nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	// Store new refresh token and invalidate old one
	newTokenRecord := &models.RefreshToken{
		Token:     newRefreshToken,
		UserID:    user.ID,
		Expiry:    time.Now().Add(30 * 24 * time.Hour), // 30 days
		IsActive:  true,
		IsUsed:    false,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := a.userRepo.StoreRefreshToken(ctx, newTokenRecord); err != nil {
		return "", "", nil, fmt.Errorf("failed to store new refresh token: %w", err)
	}

	// Invalidate the old refresh token
	if err := a.userRepo.InvalidateRefreshToken(refreshToken); err != nil {
		// Log but don't fail the refresh operation
		fmt.Printf("warning: failed to invalidate old refresh token: %v\n", err)
	}

	// Don't expose password hash in response
	user.PasswordHash = ""

	return newAccessToken, newRefreshToken, user, nil
}

func (a *authUsecase) RevokeToken(ctx context.Context, tokenID uuid.UUID) error {
	// This would involve looking up a refresh token by ID and invalidating it
	// Implementation depends on how refresh tokens are stored
	return errors.New("not implemented")
}

func (a *authUsecase) RevokeAllUserTokens(ctx context.Context, userID uuid.UUID) error {
	return a.userRepo.RevokeAllUserRefreshTokens(ctx, userID)
}

func (a *authUsecase) ActivateAccount(ctx context.Context, token, password string) error {
	if token == "" || password == "" {
		return errors.New("token and password are required")
	}

	// Validate password policy
	if err := utils.ValidatePasswordPolicy(password); err != nil {
		return err
	}

	// Hash the password
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// Validate activation token
	claims, err := utils.ValidateActivationToken(token, a.jwtSecret)
	if err != nil {
		return fmt.Errorf("invalid activation token: %w", err)
	}

	// Get user by ID from token
	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		return fmt.Errorf("invalid user ID in token: %w", err)
	}

	user, err := a.userRepo.GetUser(userID, false)
	if err != nil {
		return fmt.Errorf("user not found: %w", err)
	}

	// Update user with new password and activate account
	user.PasswordHash = string(hash)
	user.IsActive = true
	now := time.Now()
	user.PasswordSetAt = &now
	user.PasswordChangedAt = &now
	user.IsPasswordResetRequired = false

	if err := a.userRepo.UpdateActivationFields(user); err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}

	return nil
}

func (a *authUsecase) RequestActivation(ctx context.Context, email string) error {
	if email == "" {
		return errors.New("email is required")
	}

	user, err := a.userRepo.GetUserByEmail(email, false)
	if err != nil {
		// To prevent user enumeration, return success even if user doesn't exist
		return nil
	}

	if user.IsActive {
		return errors.New("account is already active")
	}

	// Generate activation token
	tokenID := uuid.New()
	duration := 24 * time.Hour // 24 hours
	activationToken, err := utils.GenerateActivationToken(user.ID, tokenID, a.jwtSecret, duration)
	if err != nil {
		return fmt.Errorf("failed to generate activation token: %w", err)
	}

	// Send activation email
	frontend := ""
	if v := os.Getenv("WEB_APP_ORIGIN"); v != "" {
		frontend = v + "/activate"
	} else {
		frontend = "http://localhost:3001/activate"
	}
	activationLink := fmt.Sprintf("%s?token=%s", frontend, activationToken)

	if a.notificationPort != nil {
		if err := a.notificationPort.SendActivationLink(ctx, user.ID, user.Email, activationLink); err != nil {
			return fmt.Errorf("failed to send activation email: %w", err)
		}
	}

	return nil
}

func (a *authUsecase) ForgotPassword(ctx context.Context, email string) error {
	if email == "" {
		return errors.New("email is required")
	}

	user, err := a.userRepo.GetUserByEmail(email, false)
	if err != nil {
		// To prevent user enumeration, return success even if user doesn't exist
		return nil
	}

	// Generate password reset token
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return errors.New("failed to generate reset token")
	}
	rawHex := hex.EncodeToString(raw)
	h := sha256.Sum256([]byte(rawHex))
	hashHex := hex.EncodeToString(h[:])
	
	resetToken := &models.PasswordResetToken{
		UserID:    user.ID,
		TokenHash: hashHex,
		Expiry:    time.Now().Add(15 * time.Minute),
		CreatedAt: time.Now(),
	}

	if err := a.passwordResetRepo.Create(resetToken); err != nil {
		return fmt.Errorf("failed to create password reset token: %w", err)
	}

	// Send reset email
	frontend := ""
	if v := os.Getenv("WEB_APP_ORIGIN"); v != "" {
		frontend = v + "/reset-password"
	} else {
		frontend = "http://localhost:3001/reset-password"
	}
	resetLink := fmt.Sprintf("%s?token=%s", frontend, rawHex)

	if a.notificationPort != nil {
		if err := a.notificationPort.SendPasswordResetLink(ctx, user.ID, user.Email, resetLink); err != nil {
			return fmt.Errorf("failed to send password reset email: %w", err)
		}
	}

	return nil
}

func (a *authUsecase) ResetPassword(ctx context.Context, token, newPassword string) error {
	if token == "" || newPassword == "" {
		return errors.New("token and new password are required")
	}

	// Validate password policy
	if err := utils.ValidatePasswordPolicy(newPassword); err != nil {
		return err
	}

	// Hash the new password
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), 12)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// Hash the token to compare with stored hash
	h := sha256.Sum256([]byte(token))
	hashHex := hex.EncodeToString(h[:])

	// Find the reset token in the database
	resetToken, err := a.passwordResetRepo.FindByHash(hashHex)
	if err != nil {
		return errors.New("invalid or expired reset token")
	}

	// Check if token is expired
	if time.Now().After(resetToken.Expiry) {
		_ = a.passwordResetRepo.DeleteByID(resetToken.ID)
		return errors.New("reset token has expired")
	}

	// Get the user associated with the token
	user, err := a.userRepo.GetUser(resetToken.UserID, false)
	if err != nil {
		return errors.New("user not found")
	}

	// Update user password
	user.PasswordHash = string(hash)
	now := time.Now()
	user.PasswordChangedAt = &now
	user.IsPasswordResetRequired = false

	if err := a.userRepo.UpdateActivationFields(user); err != nil {
		return fmt.Errorf("failed to update user password: %w", err)
	}

	// Delete the used reset token
	if err := a.passwordResetRepo.DeleteByID(resetToken.ID); err != nil {
		// Log but don't fail the operation
		fmt.Printf("warning: failed to delete used reset token: %v\n", err)
	}

	// Revoke all existing refresh tokens for security
	_ = a.RevokeAllUserTokens(ctx, user.ID)

	return nil
}

func (a *authUsecase) ValidateToken(ctx context.Context, token string) (*models.User, error) {
	claims, err := utils.ValidateAccessToken(token, a.jwtSecret)
	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}

	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		return nil, fmt.Errorf("invalid user ID in token: %w", err)
	}

	user, err := a.userRepo.GetUser(userID, false)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	if !user.IsActive {
		return nil, errors.New("account is deactivated")
	}

	// Don't expose password hash in response
	user.PasswordHash = ""

	return &user, nil
}

func (a *authUsecase) ChangePassword(ctx context.Context, userID uuid.UUID, currentPassword, newPassword string) error {
	if currentPassword == "" || newPassword == "" {
		return errors.New("current password and new password are required")
	}

	if currentPassword == newPassword {
		return errors.New("new password must be different from current password")
	}

	// Validate password policy
	if err := utils.ValidatePasswordPolicy(newPassword); err != nil {
		return err
	}

	user, err := a.userRepo.GetUser(userID, false)
	if err != nil {
		return fmt.Errorf("user not found: %w", err)
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(currentPassword)); err != nil {
		return errors.New("incorrect current password")
	}

	// Hash the new password
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), 12)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// Update user with new password
	user.PasswordHash = string(hash)
	now := time.Now()
	user.PasswordChangedAt = &now

	if err := a.userRepo.UpdateActivationFields(user); err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}

	return nil
}

func (a *authUsecase) Logout(ctx context.Context, userID uuid.UUID) error {
	// For logout, we typically just revoke all refresh tokens for the user
	return a.RevokeAllUserTokens(ctx, userID)
}

// generateRefreshToken generates a cryptographically secure random refresh token
func (a *authUsecase) generateRefreshToken() (string, error) {
	bytes := make([]byte, 32) // 256 bits
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}