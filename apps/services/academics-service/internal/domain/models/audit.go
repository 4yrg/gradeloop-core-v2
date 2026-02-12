package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type AuditLog struct {
	ID        uuid.UUID      `gorm:"type:uuid;primaryKey"`
	ActorID   *uuid.UUID     `gorm:"type:uuid;index"`
	Action    string         `gorm:"not null;index"`
	Entity    string         `gorm:"not null;index"`
	EntityID  string         `gorm:"not null;index"`
	OldValue  datatypes.JSON `gorm:"type:jsonb"`
	NewValue  datatypes.JSON `gorm:"type:jsonb"`
	IPAddress string
	UserAgent string
	TraceID   string    `gorm:"index"`
	CreatedAt time.Time `gorm:"index"`
}

func (a *AuditLog) BeforeCreate(tx *gorm.DB) (err error) {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return
}
