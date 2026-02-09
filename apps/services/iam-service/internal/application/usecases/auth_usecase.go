package usecases

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"log/slog"
	"time"

	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/application/ports"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type AuthUsecase struct {
	userRepo         ports.UserRepository
	refreshTokenRepo ports.RefreshTokenRepository
}

func NewAuthUsecase(userRepo ports.UserRepository, refreshTokenRepo ports.RefreshTokenRepository) *AuthUsecase {
	return &AuthUsecase{
		userRepo:         userRepo,
		refreshTokenRepo: refreshTokenRepo,
	}
}

// hashToken generates SHA256 hash of the raw token string
func (uc *AuthUsecase) hashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}

// Login authenticates a user and returns a raw refresh token and user details
func (uc *AuthUsecase) Login(email, password string) (string, *models.User, error) {
	user, err := uc.userRepo.GetUserByEmail(email, false)
	if err != nil {
		return "", nil, errors.New("unauthorized: invalid credentials")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return "", nil, errors.New("unauthorized: invalid credentials")
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
		return "", nil, err
	}

	return rawToken, user, nil
}

// Refresh validates the old token and issues a new rotated token
func (uc *AuthUsecase) Refresh(oldTokenStr string) (string, *models.User, error) {
	tokenHash := uc.hashToken(oldTokenStr)
	token, err := uc.refreshTokenRepo.GetByHash(tokenHash)
	if err != nil {
		// Log attempt with unknown token hash
		slog.Warn("Security event: attempt to refresh with non-matching hash or missing token", "token_hash", tokenHash)
		return "", nil, errors.New("unauthorized: invalid token")
	}

	// Security Event Logging for revoked or expired tokens
	if token.IsRevoked || token.ExpiresAt.Before(time.Now()) {
		slog.Warn("Security event: attempt to reuse revoked or expired token",
			"token_id", token.TokenID,
			"user_id", token.UserID,
			"is_revoked", token.IsRevoked,
			"is_expired", token.ExpiresAt.Before(time.Now()))
		return "", nil, errors.New("unauthorized: token is invalid")
	}

	user, err := uc.userRepo.GetUser(token.UserID, false)
	if err != nil {
		return "", nil, errors.New("unauthorized: user context lost")
	}

	// Revoke old token (Rotation)
	if err := uc.refreshTokenRepo.Revoke(token.TokenID); err != nil {
		return "", nil, err
	}

	// Issue new token
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
		return "", nil, err
	}

	return newRawToken, user, nil
}

// RevokeToken performs individual revocation
func (uc *AuthUsecase) RevokeToken(tokenID uuid.UUID) error {
	return uc.refreshTokenRepo.Revoke(tokenID)
}

// RevokeAllUserTokens performs bulk revocation for a specific user
func (uc *AuthUsecase) RevokeAllUserTokens(userID uuid.UUID) error {
	return uc.refreshTokenRepo.RevokeAllForUser(userID)
}
