package models

import (
	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// AuditLog is a placeholder to allow service compilation.
// The real implementation will use the shared audit library.
type AuditLog struct {
	Action   string
	Entity   string
	EntityID string
	ActorID  *uuid.UUID
	OldValue datatypes.JSON
	NewValue datatypes.JSON
	TraceID  string
}
