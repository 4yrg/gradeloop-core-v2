package utils

import (
	"context"
	"encoding/json"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
	"github.com/google/uuid"
	"gorm.io/datatypes"
)

// PrepareAuditLog creates an AuditLog model.
func PrepareAuditLog(ctx context.Context, action, entity, entityID string, oldValue, newValue interface{}) *models.AuditLog {
	oldJSON, _ := json.Marshal(oldValue)
	newJSON, _ := json.Marshal(newValue)

	var actorID *uuid.UUID
	if val, ok := ctx.Value("user_id").(string); ok {
		if parsed, err := uuid.Parse(val); err == nil {
			actorID = &parsed
		}
	}

	return &models.AuditLog{
		Action:   action,
		Entity:   entity,
		EntityID: entityID,
		ActorID:  actorID,
		OldValue: datatypes.JSON(oldJSON),
		NewValue: datatypes.JSON(newJSON),
	}
}
