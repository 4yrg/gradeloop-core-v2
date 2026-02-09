package models

import (
	"time"

	"github.com/google/uuid"
)

type RefreshToken struct {
	TokenID    uuid.UUID `gorm:"type:uuid;primaryKey" json:"token_id"`
	TokenHash  string    `gorm:"uniqueIndex;not null" json:"-"`
	UserID     uuid.UUID `gorm:"type:uuid;not null;index" json:"user_id"`
	ExpiresAt  time.Time `gorm:"not null" json:"expires_at"`
	IsRevoked  bool      `gorm:"default:false" json:"is_revoked"`
	ActionType string    `gorm:"type:varchar(50)" json:"action_type"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`

	// Many-to-One relationship with User
	User User `gorm:"foreignKey:UserID" json:"-"`
}
