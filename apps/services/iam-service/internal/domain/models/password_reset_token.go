package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// PasswordResetToken represents a password reset token for secure password recovery
type PasswordResetToken struct {
	ID        uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	TokenHash string         `gorm:"uniqueIndex;not null" json:"-"` // SHA256 hash of the actual token
	UserID    uuid.UUID      `gorm:"type:uuid;not null;index" json:"user_id"`
	ExpiresAt time.Time      `gorm:"not null" json:"expires_at"`
	IsUsed    bool           `gorm:"default:false" json:"is_used"`
	UsedAt    *time.Time     `json:"used_at"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Relationships
	User User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (t *PasswordResetToken) BeforeCreate(tx *gorm.DB) (err error) {
	if t.ID == uuid.Nil {
		t.ID = uuid.New()
	}
	return
}

// IsExpired checks if the token has expired
func (t *PasswordResetToken) IsExpired() bool {
	return time.Now().After(t.ExpiresAt)
}

// IsValid checks if the token is valid (not used and not expired)
func (t *PasswordResetToken) IsValid() bool {
	return !t.IsUsed && !t.IsExpired()
}

// MarkAsUsed marks the token as used
func (t *PasswordResetToken) MarkAsUsed() {
	now := time.Now()
	t.IsUsed = true
	t.UsedAt = &now
}
