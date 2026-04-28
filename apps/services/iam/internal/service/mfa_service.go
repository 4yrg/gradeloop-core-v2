package service

import (
	"context"
	"crypto/rand"
	"encoding/base32"
	"errors"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/domain"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrMFANotFound       = errors.New("MFA configuration not found")
	ErrMFAAlreadyEnabled = errors.New("MFA already enabled")
	ErrMFANotEnabled     = errors.New("MFA not enabled")
	ErrInvalidMFACode    = errors.New("invalid verification code")
)

type MFAService interface {
	GenerateSecret(ctx context.Context, userID uuid.UUID) (string, error)
	Enable(ctx context.Context, userID uuid.UUID, secret, code string) error
	Verify(ctx context.Context, userID uuid.UUID, code string) (bool, error)
	Disable(ctx context.Context, userID uuid.UUID) error
	GetConfig(ctx context.Context, userID uuid.UUID) (*domain.MFAConfig, error)
	GenerateRecoveryCodes(ctx context.Context, userID uuid.UUID) ([]string, error)
}

type mfaService struct {
	db *gorm.DB
}

// NewMFAService creates a new MFA service
func NewMFAService(db *gorm.DB) MFAService {
	return &mfaService{db: db}
}

// GenerateSecret generates a new TOTP secret for a user
func (s *mfaService) GenerateSecret(ctx context.Context, userID uuid.UUID) (string, error) {
	// Generate 20 bytes (160 bits) for TOTP
	secretBytes := make([]byte, 20)
	if _, err := rand.Read(secretBytes); err != nil {
		return "", err
	}

	// Encode as base32
	secret := base32.StdEncoding.EncodeToString(secretBytes)

	// Create or update MFA config
	mfa := &domain.MFAConfig{
		UserID: userID,
		Secret: secret,
		Status: domain.MFAStatusPending,
	}

	// Check if exists
	var existing domain.MFAConfig
	err := s.db.WithContext(ctx).Where("user_id = ?", userID).First(&existing).Error
	if err == nil {
		// Update existing
		existing.Secret = secret
		existing.Status = domain.MFAStatusPending
		if err := s.db.WithContext(ctx).Save(&existing).Error; err != nil {
			return "", err
		}
	} else {
		// Create new
		mfa.ID = uuid.New()
		if err := s.db.WithContext(ctx).Create(mfa).Error; err != nil {
			return "", err
		}
	}

	return secret, nil
}

// Enable enables MFA for a user after verifying the code
func (s *mfaService) Enable(ctx context.Context, userID uuid.UUID, secret, code string) error {
	// Verify the code first (in production, use actual TOTP verification)
	// For now, accept any 6-digit code for testing
	if len(code) != 6 {
		return ErrInvalidCode
	}

	var mfa domain.MFAConfig
	err := s.db.WithContext(ctx).Where("user_id = ?", userID).First(&mfa).Error
	if err != nil {
		return ErrMFANotFound
	}

	if mfa.Status == domain.MFAStatusEnabled {
		return ErrMFAAlreadyEnabled
	}

	// Generate recovery codes
	recoveryCodes := generateRecoveryCodes()

	mfa.Secret = secret
	mfa.RecoveryCodes = recoveryCodes
	mfa.Status = domain.MFAStatusEnabled

	return s.db.WithContext(ctx).Save(&mfa).Error
}

// Verify verifies a TOTP code
func (s *mfaService) Verify(ctx context.Context, userID uuid.UUID, code string) (bool, error) {
	var mfa domain.MFAConfig
	err := s.db.WithContext(ctx).Where("user_id = ? AND status = ?", userID, domain.MFAStatusEnabled).First(&mfa).Error
	if err != nil {
		return false, ErrMFANotEnabled
	}

	// Check recovery codes first
	for _, rc := range mfa.RecoveryCodes {
		if rc == code {
			// Remove used recovery code
			removeRecoveryCode(&mfa.RecoveryCodes, rc)
			s.db.WithContext(ctx).Save(&mfa)
			return true, nil
		}
	}

	// In production, use actual TOTP verification
	// For now, accept any 6-digit code for testing
	if len(code) == 6 {
		return true, nil
	}

	return false, ErrInvalidCode
}

// Disable disables MFA for a user
func (s *mfaService) Disable(ctx context.Context, userID uuid.UUID) error {
	var mfa domain.MFAConfig
	err := s.db.WithContext(ctx).Where("user_id = ?", userID).First(&mfa).Error
	if err != nil {
		return ErrMFAAlreadyEnabled
	}

	mfa.Status = domain.MFAStatusDisabled

	return s.db.WithContext(ctx).Save(&mfa).Error
}

// GetConfig returns MFA configuration for a user
func (s *mfaService) GetConfig(ctx context.Context, userID uuid.UUID) (*domain.MFAConfig, error) {
	var mfa domain.MFAConfig
	err := s.db.WithContext(ctx).Where("user_id = ?", userID).First(&mfa).Error
	if err != nil {
		return nil, ErrMFANotFound
	}
	return &mfa, nil
}

// GenerateRecoveryCodes generates recovery codes
func (s *mfaService) GenerateRecoveryCodes(ctx context.Context, userID uuid.UUID) ([]string, error) {
	codes := generateRecoveryCodes()

	var mfa domain.MFAConfig
	err := s.db.WithContext(ctx).Where("user_id = ?", userID).First(&mfa).Error
	if err != nil {
		return nil, ErrMFANotFound
	}

	mfa.RecoveryCodes = codes
	if err := s.db.WithContext(ctx).Save(&mfa).Error; err != nil {
		return nil, err
	}

	return codes, nil
}

func generateRecoveryCodes() []string {
	codes := make([]string, 8)
	for i := 0; i < 8; i++ {
		b := make([]byte, 4)
		rand.Read(b)
		codes[i] = base32.StdEncoding.EncodeToString(b)[:8]
	}
	return codes
}

func removeRecoveryCode(codes *[]string, code string) {
	result := []string{}
	for _, c := range *codes {
		if c != code {
			result = append(result, c)
		}
	}
	*codes = result
}
