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

type AuthUsecase struct {
	userRepo  ports.UserRepository
	prRepo    ports.PasswordResetRepository
	notifier  ports.NotificationPort
	jwtSecret string
	jwtExpiry time.Duration
	auditRepo ports.AuditRepository
}

func NewAuthUsecase(userRepo ports.UserRepository, prRepo ports.PasswordResetRepository, notifier ports.NotificationPort, jwtSecret string, jwtExpiry time.Duration, audit ports.AuditRepository) *AuthUsecase {
	return &AuthUsecase{userRepo: userRepo, prRepo: prRepo, notifier: notifier, jwtSecret: jwtSecret, jwtExpiry: jwtExpiry, auditRepo: audit}
}

// Login returns accessToken, user
func (a *AuthUsecase) Login(ctx context.Context, email, password string) (string, *models.User, error) {
	if email == "" || password == "" {
		return "", nil, errors.New("invalid credentials")
	}
	user, err := a.userRepo.GetUserByEmail(email, false)
	if err != nil {
		return "", nil, errors.New("invalid credentials")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		if a.auditRepo != nil {
			_ = a.auditRepo.CreateAuditLog(ctx, &models.AuditLog{Action: "suspicious_login_attempt", Entity: "users", EntityID: user.Email})
		}
		return "", nil, errors.New("invalid credentials")
	}
	roles, _ := a.userRepo.GetRolesByUserID(user.ID)
	perms, _ := a.userRepo.GetPermissionsByUserID(user.ID)
	token, err := utils.GenerateAccessToken(user.ID, roles, perms, a.jwtSecret, a.jwtExpiry)
	if err != nil {
		return "", nil, fmt.Errorf("failed to generate token: %w", err)
	}
	// Do not expose password hash
	user.PasswordHash = ""
	return token, user, nil
}

func (a *AuthUsecase) GetJWTSecret() string { return a.jwtSecret }

func (a *AuthUsecase) GetUserByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	return a.userRepo.GetUser(id, false)
}

func (a *AuthUsecase) RequestActivation(ctx context.Context, email string) error {
	return errors.New("not implemented")
}

func (a *AuthUsecase) ActivateAccount(ctx context.Context, token, password string) error {
	return errors.New("not implemented")
}

func (a *AuthUsecase) Refresh(ctx context.Context, refreshToken string) (string, string, *models.User, error) {
	return "", "", nil, errors.New("not implemented")
}

func (a *AuthUsecase) RevokeToken(ctx context.Context, tokenID uuid.UUID) error {
	return errors.New("not implemented")
}

func (a *AuthUsecase) RevokeAllUserTokens(ctx context.Context, userID uuid.UUID) error {
	return errors.New("not implemented")
}

func (a *AuthUsecase) ChangePassword(ctx context.Context, userID uuid.UUID, currentPassword, newPassword string) error {
	user, err := a.userRepo.GetUser(userID, false)
	if err != nil {
		return err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(currentPassword)); err != nil {
		return errors.New("incorrect current password")
	}
	if err := utils.ValidatePasswordPolicy(newPassword); err != nil {
		return err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), 12)
	if err != nil {
		return err
	}
	user.PasswordHash = string(hash)
	now := time.Now()
	user.PasswordChangedAt = &now
	return a.userRepo.UpdateActivationFields(user)
}

// ForgotPassword and ResetPassword delegate to password reset repository and notifier
func (a *AuthUsecase) ForgotPassword(ctx context.Context, email string) error {
	if email == "" {
		return nil
	}
	user, err := a.userRepo.GetUserByEmail(email, false)
	if err != nil {
		return nil
	}
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return nil
	}
	rawHex := hex.EncodeToString(raw)
	h := sha256.Sum256([]byte(rawHex))
	hashHex := hex.EncodeToString(h[:])
	pr := &models.PasswordResetToken{UserID: user.ID, TokenHash: hashHex, ExpiresAt: time.Now().Add(15 * time.Minute)}
	_ = a.prRepo.Create(pr)
	frontend := ""
	if v := os.Getenv("WEB_APP_ORIGIN"); v != "" {
		frontend = v + "/reset-password"
	} else {
		frontend = "http://localhost:3001/reset-password"
	}
	resetLink := fmt.Sprintf("%s?token=%s", frontend, rawHex)
	if a.notifier != nil {
		_ = a.notifier.SendPasswordResetLink(ctx, user.ID, user.Email, resetLink)
	}
	return nil
}

func (a *AuthUsecase) ResetPassword(ctx context.Context, token, newPassword string) error {
	if token == "" || newPassword == "" {
		return errors.New("invalid request")
	}
	if err := utils.ValidatePasswordPolicy(newPassword); err != nil {
		return err
	}
	h := sha256.Sum256([]byte(token))
	hashHex := hex.EncodeToString(h[:])
	pr, err := a.prRepo.FindByHash(hashHex)
	if err != nil {
		return errors.New("invalid or expired token")
	}
	if time.Now().After(pr.ExpiresAt) {
		_ = a.prRepo.DeleteByID(pr.ID)
		return errors.New("invalid or expired token")
	}
	user, err := a.userRepo.GetUser(pr.UserID, false)
	if err != nil {
		return errors.New("invalid or expired token")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), 12)
	if err != nil {
		return errors.New("failed to hash password")
	}
	user.PasswordHash = string(hash)
	now := time.Now()
	user.PasswordChangedAt = &now
	user.IsPasswordResetRequired = false
	if err := a.userRepo.UpdateActivationFields(user); err != nil {
		return errors.New("failed to update password")
	}
	_ = a.prRepo.DeleteByID(pr.ID)
	return nil
}
