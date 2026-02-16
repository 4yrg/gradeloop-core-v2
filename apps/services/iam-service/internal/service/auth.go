package service

import (
	"context"
	"os"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/dto"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/errors"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/utils"
	"github.com/golang-jwt/jwt/v5"
)

// Extend AuthService interface
type AuthService interface {
	Login(ctx context.Context, req dto.LoginRequest, ip, userAgent string) (*dto.AuthResponse, error)
	RefreshToken(ctx context.Context, refreshToken string, ip, userAgent string) (*dto.AuthResponse, error)
	Logout(ctx context.Context, refreshToken string, all bool, userID string) error
	RequestPasswordReset(ctx context.Context, email string) (string, error)
	ResetPassword(ctx context.Context, token, newPassword string) error
}

type authService struct {
	userRepo   domain.UserRepository
	tokenRepo  domain.RefreshTokenRepository
	passwdRepo domain.PasswordResetRepository
	auditRepo  domain.AuditRepository
}

func NewAuthService(
	userRepo domain.UserRepository,
	tokenRepo domain.RefreshTokenRepository,
	passwdRepo domain.PasswordResetRepository,
	auditRepo domain.AuditRepository,
) AuthService {
	return &authService{
		userRepo:   userRepo,
		tokenRepo:  tokenRepo,
		passwdRepo: passwdRepo,
		auditRepo:  auditRepo,
	}
}

func (s *authService) Login(ctx context.Context, req dto.LoginRequest, ip, userAgent string) (*dto.AuthResponse, error) {
	// ... (Same as before)
	// Need to duplicate logic here because I am overwriting the file?
	// replace_file_content would be better if I could append.
	// I already wrote it in previous step.
	// I should use replace_file_content to ADD methods or overwrite the file with ALL methods.
	// Overwriting with ALL methods including the ones I wrote before.

	// Copying previous Login logic...
	user, err := s.userRepo.FindByEmail(ctx, req.Email)
	if err != nil {
		return nil, errors.New(401, "Invalid email or password", nil)
	}

	if !utils.CheckPasswordHash(req.Password, user.PasswordHash) {
		return nil, errors.New(401, "Invalid email or password", nil)
	}

	if !user.IsActive {
		return nil, errors.New(401, "User is not active", nil)
	}

	return s.generateTokens(ctx, user, ip, userAgent)
}

func (s *authService) RefreshToken(ctx context.Context, refreshToken string, ip, userAgent string) (*dto.AuthResponse, error) {
	hash := utils.HashToken(refreshToken)
	token, err := s.tokenRepo.FindByTokenHash(ctx, hash)
	if err != nil {
		return nil, errors.New(401, "Invalid refresh token", err)
	}

	user, err := s.userRepo.FindByID(ctx, token.UserID)
	if err != nil {
		return nil, errors.New(401, "User found but invalid", err)
	}

	newToken := utils.GenerateRandomString(32)
	newHash := utils.HashToken(newToken)

	newRT := &domain.RefreshToken{
		UserID:    user.ID,
		TokenHash: newHash,
		ExpiresAt: time.Now().Add(72 * time.Hour),
		IP:        ip,
		UserAgent: userAgent,
	}
	if err := s.tokenRepo.Create(ctx, newRT); err != nil {
		return nil, errors.New(500, "Failed to create new token", err)
	}

	s.tokenRepo.Revoke(ctx, token.ID, newHash)

	accessToken, err := s.createAccessToken(user)
	if err != nil {
		return nil, errors.New(500, "Failed to create access token", err)
	}

	return &dto.AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: newToken,
	}, nil
}

func (s *authService) Logout(ctx context.Context, refreshToken string, all bool, userID string) error {
	if all && userID != "" {
		return s.tokenRepo.RevokeAllForUser(ctx, userID)
	}

	hash := utils.HashToken(refreshToken)
	token, err := s.tokenRepo.FindByTokenHash(ctx, hash)
	if err != nil {
		return nil // Already invalid or not found, considers logged out
	}

	return s.tokenRepo.Revoke(ctx, token.ID, "")
}

func (s *authService) RequestPasswordReset(ctx context.Context, email string) (string, error) {
	user, err := s.userRepo.FindByEmail(ctx, email)
	if err != nil {
		// Return success even if user not found to prevent user enumeration
		return "simulation_token", nil
	}

	// Generate Token (UUID or random string, let's use random string as token)
	token := utils.GenerateRandomString(32) // Should be UUID per requirement?
	// "Token must: Be UUID".
	// I need UUID generator.
	// For now, I'll stick to random string and handle "Be UUID" requirement by maybe formatting it?
	// Or I'll import google/uuid in utils.
	// Let's assume utils.GenerateUUID() exists (I'll implement it).

	token = utils.GenerateUUID()
	hash := utils.HashToken(token)

	resetToken := &domain.PasswordResetToken{
		UserID:    user.ID,
		TokenHash: hash,
		ExpiresAt: time.Now().Add(15 * time.Minute),
	}

	if err := s.passwdRepo.Create(ctx, resetToken); err != nil {
		return "", errors.New(500, "Failed to create reset token", err)
	}

	s.auditRepo.Create(ctx, &domain.AuditLog{
		Action:     "PASSWORD_RESET_REQUEST",
		EntityName: "users",
		EntityID:   user.ID,
	})

	return token, nil // Return token for simulation/email
}

func (s *authService) ResetPassword(ctx context.Context, token, newPassword string) error {
	hash := utils.HashToken(token)

	resetToken, err := s.passwdRepo.FindByTokenHash(ctx, hash)
	if err != nil {
		return errors.New(400, "Invalid or expired token", nil)
	}

	if resetToken.UsedAt != nil || time.Now().After(resetToken.ExpiresAt) {
		return errors.New(400, "Token expired or used", nil)
	}

	user, err := s.userRepo.FindByID(ctx, resetToken.UserID)
	if err != nil {
		return errors.New(404, "User not found", err)
	}

	newPassHash, err := utils.HashPassword(newPassword)
	if err != nil {
		return errors.New(500, "Failed to hash password", err)
	}

	user.PasswordHash = newPassHash
	user.IsPasswordResetRequired = false

	if err := s.userRepo.Update(ctx, user); err != nil {
		return errors.New(500, "Failed to update password", err)
	}

	s.passwdRepo.MarkAsUsed(ctx, resetToken.ID)

	// Revoke all sessions
	s.tokenRepo.RevokeAllForUser(ctx, user.ID)

	s.auditRepo.Create(ctx, &domain.AuditLog{
		Action:     "PASSWORD_RESET_COMPLETE",
		EntityName: "users",
		EntityID:   user.ID,
	})

	return nil
}

func (s *authService) generateTokens(ctx context.Context, user *domain.User, ip, userAgent string) (*dto.AuthResponse, error) {
	at, err := s.createAccessToken(user)
	if err != nil {
		return nil, err
	}

	rawRT := utils.GenerateRandomString(32)
	hash := utils.HashToken(rawRT)

	rt := &domain.RefreshToken{
		UserID:    user.ID,
		TokenHash: hash,
		ExpiresAt: time.Now().Add(30 * 24 * time.Hour),
		IP:        ip,
		UserAgent: userAgent,
	}

	if err := s.tokenRepo.Create(ctx, rt); err != nil {
		return nil, err
	}

	return &dto.AuthResponse{
		AccessToken:  at,
		RefreshToken: rawRT,
	}, nil
}

func (s *authService) createAccessToken(user *domain.User) (string, error) {
	claims := jwt.MapClaims{
		"user_id":  user.ID,
		"username": user.Email,
		"exp":      time.Now().Add(15 * time.Minute).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(os.Getenv("SECRET")))
}
