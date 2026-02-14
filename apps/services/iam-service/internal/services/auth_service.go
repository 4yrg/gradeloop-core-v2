package services

import (
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/utils"
)

// AuthService handles authentication-related operations
type AuthService struct {
	DB        *gorm.DB
	JWTSecret string
}

// NewAuthService creates a new authentication service instance
func NewAuthService(db *gorm.DB, jwtSecret string) *AuthService {
	return &AuthService{
		DB:        db,
		JWTSecret: jwtSecret,
	}
}

// Login authenticates a user and returns tokens
func (s *AuthService) Login(email, password string) (map[string]string, error) {
	var user domain.User
	result := s.DB.First(&user, "email = ?", email)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return nil, errors.New("invalid credentials")
	}
	if result.Error != nil {
		return nil, fmt.Errorf("failed to retrieve user: %w", result.Error)
	}

	// Check if user is active
	if !user.IsActive {
		return nil, errors.New("account is deactivated")
	}

	// Compare password
	if !utils.CheckPasswordHash(password, user.Password) {
		return nil, errors.New("invalid credentials")
	}

	// Get user roles (simplified - in a real system you'd join with roles table)
	roles := []string{"user"} // Default role, in a real system you'd fetch from DB

	// Generate access token (valid for 15 minutes)
	accessToken, err := utils.GenerateAccessToken(user.ID, user.Email, user.FullName, roles, s.JWTSecret, 15*time.Minute)
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	// Generate refresh token (valid for 30 days)
	refreshToken, err := utils.GenerateRefreshToken(user.ID, user.Email, s.JWTSecret, 30*24*time.Hour)
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	// Store refresh token in database
	refreshTokenHash, err := utils.HashPassword(refreshToken)
	if err != nil {
		return nil, fmt.Errorf("failed to hash refresh token: %w", err)
	}

	refreshTokenEntry := &domain.RefreshToken{
		ID:        uuid.New(),
		UserID:    user.ID,
		TokenHash: refreshTokenHash,
		ExpiresAt: time.Now().Add(30 * 24 * time.Hour),
		IsRevoked: false,
	}

	result = s.DB.Create(refreshTokenEntry)
	if result.Error != nil {
		return nil, fmt.Errorf("failed to store refresh token: %w", result.Error)
	}

	return map[string]string{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
	}, nil
}

// RefreshToken validates a refresh token and returns a new access token
func (s *AuthService) RefreshToken(refreshToken string) (string, error) {
	// Find the refresh token in the database
	var dbToken domain.RefreshToken
	result := s.DB.Where("expires_at > ?", time.Now()).First(&dbToken)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return "", errors.New("invalid or expired refresh token")
	}
	if result.Error != nil {
		return "", fmt.Errorf("failed to retrieve refresh token: %w", result.Error)
	}

	// Verify the token hasn't been revoked
	if dbToken.IsRevoked {
		return "", errors.New("refresh token has been revoked")
	}

	// Verify the token hash matches
	if !utils.CheckPasswordHash(refreshToken, dbToken.TokenHash) {
		return "", errors.New("invalid refresh token")
	}

	// Get the user
	var user domain.User
	result = s.DB.First(&user, "id = ?", dbToken.UserID)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return "", errors.New("user not found")
	}
	if result.Error != nil {
		return "", fmt.Errorf("failed to retrieve user: %w", result.Error)
	}

	// Get user roles (simplified)
	roles := []string{"user"}

	// Generate new access token
	newAccessToken, err := utils.GenerateAccessToken(user.ID, user.Email, user.FullName, roles, s.JWTSecret, 15*time.Minute)
	if err != nil {
		return "", fmt.Errorf("failed to generate new access token: %w", err)
	}

	return newAccessToken, nil
}

// ActivateAccount activates a user account with a password
func (s *AuthService) ActivateAccount(token, password string) error {
	// In a real system, you would verify the activation token here
	// For now, we'll simulate the process

	// Validate password strength
	if err := utils.ValidatePasswordStrength(password); err != nil {
		return fmt.Errorf("password validation failed: %w", err)
	}

	// Hash the password
	_, err := utils.HashPassword(password)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// In a real system, you would decode the token to get the user ID
	// and update the user's password and activation status
	// For now, we'll just return nil to indicate success
	return nil
}

// ForgotPassword initiates a password reset process
func (s *AuthService) ForgotPassword(email string) error {
	// Find the user
	var user domain.User
	result := s.DB.First(&user, "email = ?", email)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		// Don't reveal if email exists to prevent enumeration attacks
		return nil
	}
	if result.Error != nil {
		return fmt.Errorf("failed to retrieve user: %w", result.Error)
	}

	// In a real system, you would generate a password reset token
	// and send it to the user's email
	// For now, we'll just return nil to indicate success
	return nil
}

// ResetPassword resets a user's password using a reset token
func (s *AuthService) ResetPassword(token, newPassword string) error {
	// In a real system, you would verify the reset token here
	// and update the user's password

	// Validate password strength
	if err := utils.ValidatePasswordStrength(newPassword); err != nil {
		return fmt.Errorf("password validation failed: %w", err)
	}

	// Hash the new password
	_, err := utils.HashPassword(newPassword)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// In a real system, you would decode the token to get the user ID
	// and update the user's password
	// For now, we'll just return nil to indicate success
	return nil
}

// RevokeRefreshToken revokes a refresh token
func (s *AuthService) RevokeRefreshToken(userID uuid.UUID, tokenHash string) error {
	result := s.DB.Model(&domain.RefreshToken{}).
		Where("user_id = ? AND token_hash = ? AND is_revoked = ?", userID, tokenHash, false).
		Update("is_revoked", true)

	if result.Error != nil {
		return fmt.Errorf("failed to revoke refresh token: %w", result.Error)
	}

	return nil
}

// CreateInitialAdmin creates the initial super admin user if none exists
func (s *AuthService) CreateInitialAdmin(email, password string) error {
	// Check if any users exist
	var count int64
	result := s.DB.Model(&domain.User{}).Count(&count)
	if result.Error != nil {
		return fmt.Errorf("failed to check for existing users: %w", result.Error)
	}

	if count > 0 {
		return errors.New("users already exist, cannot create initial admin")
	}

	// Validate password strength
	if err := utils.ValidatePasswordStrength(password); err != nil {
		return fmt.Errorf("password validation failed: %w", err)
	}

	// Hash the password
	hashedPassword, err := utils.HashPassword(password)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// Create the admin user
	adminUser := &domain.User{
		ID:                      uuid.New(),
		Email:                   email,
		FullName:                "Super Administrator",
		Password:                hashedPassword,
		IsActive:                true,
		UserType:                "admin",
		IsPasswordResetRequired: true, // Require password reset on first login
	}

	result = s.DB.Create(adminUser)
	if result.Error != nil {
		return fmt.Errorf("failed to create admin user: %w", result.Error)
	}

	return nil
}
