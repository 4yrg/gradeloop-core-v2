package utils

import (
	"context"
	"encoding/json"
	"reflect"
	"strings"

	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"github.com/google/uuid"
	"gorm.io/datatypes"
)

var sensitiveFields = map[string]bool{
	"password_hash": true,
	"token_hash":    true,
	"password":      true,
	"old_password":  true,
	"new_password":  true,
	"secret":        true,
}

// RedactData recursively masks sensitive fields in a map or struct.
func RedactData(data interface{}) interface{} {
	if data == nil {
		return nil
	}

	val := reflect.ValueOf(data)
	if val.Kind() == reflect.Ptr {
		val = val.Elem()
	}

	switch val.Kind() {
	case reflect.Map:
		newMap := make(map[string]interface{})
		for _, key := range val.MapKeys() {
			kStr := key.String()
			v := val.MapIndex(key).Interface()
			if sensitiveFields[strings.ToLower(kStr)] {
				newMap[kStr] = "[REDACTED]"
			} else {
				newMap[kStr] = RedactData(v)
			}
		}
		return newMap
	case reflect.Struct:
		// Convert struct to map for easier redaction and JSON storage
		b, _ := json.Marshal(data)
		var m map[string]interface{}
		json.Unmarshal(b, &m)
		return RedactData(m)
	case reflect.Slice:
		newSlice := make([]interface{}, val.Len())
		for i := 0; i < val.Len(); i++ {
			newSlice[i] = RedactData(val.Index(i).Interface())
		}
		return newSlice
	default:
		return data
	}
}

// PrepareAuditLog creates an AuditLog model and redacts sensitive data.
func PrepareAuditLog(ctx context.Context, action, entity, entityID string, oldValue, newValue interface{}) *models.AuditLog {
	redactedOld := RedactData(oldValue)
	redactedNew := RedactData(newValue)

	oldJSON, _ := json.Marshal(redactedOld)
	newJSON, _ := json.Marshal(redactedNew)

	var actorID *uuid.UUID
	// Try to get user_id from context (set by auth middleware or fiber locals)
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
