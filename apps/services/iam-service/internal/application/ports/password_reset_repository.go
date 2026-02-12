package ports

import (
	"context"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"github.com/google/uuid"
)

// PasswordResetRepository defines the interface for password reset token persistence operations
type PasswordResetRepository interface {
	// Create stores a new password reset token
	Create(ctx context.Context, token *models.PasswordResetToken) error

	// GetByTokenHash retrieves a password reset token by its hash
	GetByTokenHash(ctx context.Context, tokenHash string) (*models.PasswordResetToken, error)

	// GetByUserID retrieves the most recent password reset token for a user
	GetByUserID(ctx context.Context, userID uuid.UUID) (*models.PasswordResetToken, error)

	// MarkAsUsed marks a token as used
	MarkAsUsed(ctx context.Context, tokenID uuid.UUID) error

	// InvalidateAllForUser invalidates all password reset tokens for a user
	InvalidateAllForUser(ctx context.Context, userID uuid.UUID) error

	// CleanupExpired removes expired tokens (for cleanup jobs)
	CleanupExpired(ctx context.Context, before time.Time) error

	// CountActiveTokensForUser returns the number of active (unused, unexpired) tokens for a user
	CountActiveTokensForUser(ctx context.Context, userID uuid.UUID) (int64, error)
}
