package domain

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type Notification struct {
	ID        uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID    uuid.UUID      `gorm:"type:uuid;not null;index:idx_user_read_created" json:"user_id"`
	Type      string         `gorm:"type:varchar(50);not null" json:"type"`
	Title     string         `gorm:"type:varchar(255);not null" json:"title"`
	Message   string         `gorm:"type:text;not null" json:"message"`
	Data      datatypes.JSON `gorm:"type:jsonb" json:"data,omitempty"`
	Read      bool           `gorm:"not null;default:false;index:idx_user_read_created" json:"read"`
	CreatedAt time.Time       `gorm:"index:idx_user_read_created" json:"created_at"`
	ReadAt    *time.Time     `json:"read_at,omitempty"`
}

func (Notification) TableName() string { return "notifications" }

func (n *Notification) BeforeCreate(_ *gorm.DB) error {
	if n.ID == uuid.Nil {
		n.ID = uuid.New()
	}
	return nil
}