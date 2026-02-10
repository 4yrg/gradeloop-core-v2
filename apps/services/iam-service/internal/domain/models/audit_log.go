package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// AuditLog represents a record of a system mutation for compliance and security tracking.
// US11/36: record the actor, action, and JSONB snapshots of old and new values.
type AuditLog struct {
	ID        uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	ActorID   *uuid.UUID     `gorm:"type:uuid;index" json:"actor_id"` // User who performed the action
	Action    string         `gorm:"not null;index" json:"action"`    // e.g., user.update, role.delete
	Entity    string         `gorm:"not null;index" json:"entity"`    // e.g., users, roles
	EntityID  string         `gorm:"not null;index" json:"entity_id"`
	OldValue  datatypes.JSON `gorm:"type:jsonb" json:"old_value"`
	NewValue  datatypes.JSON `gorm:"type:jsonb" json:"new_value"`
	IPAddress string         `json:"ip_address"`
	UserAgent string         `json:"user_agent"`
	TraceID   string         `gorm:"index" json:"trace_id"`
	CreatedAt time.Time      `gorm:"index" json:"created_at"`
}

func (a *AuditLog) BeforeCreate(tx *gorm.DB) (err error) {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return
}

// RedactSensitiveData ensures that passwords, hashes, and secrets are not stored in audit logs.
func RedactSensitiveData(data map[string]interface{}) datatypes.JSON {
	sensitiveKeys := []string{"password", "password_hash", "token", "refresh_token", "secret"}
	for _, key := range sensitiveKeys {
		if _, ok := data[key]; ok {
			data[key] = "[REDACTED]"
		}
	}
	bytes, _ := json.Marshal(data)
	return datatypes.JSON(bytes)
}
