package domain

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// JSONB custom type for storing JSON data
type JSONB map[string]interface{}

// User represents the base user entity with soft deletes and subtypes
type User struct {
	ID                      uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	Email                   string    `gorm:"uniqueIndex;not null"`
	FullName                string    `gorm:"not null"`
	Password                string    `gorm:"column:password_hash;not null"` // bcrypt hash
	IsActive                bool      `gorm:"default:true"`
	UserType                string    `gorm:"not null;check:user_type IN ('student','instructor','admin')"`
	IsPasswordResetRequired bool      `gorm:"default:true"`
	CreatedAt               time.Time
	UpdatedAt               time.Time
	DeletedAt               gorm.DeletedAt `gorm:"index"`
}

// Student represents student-specific data
type Student struct {
	ID             uuid.UUID `gorm:"primaryKey"`
	EnrollmentDate time.Time
	StudentRegNo   string `gorm:"uniqueIndex"`
	User           User
	UserID         uuid.UUID `gorm:"column:user_id"`
	CreatedAt      time.Time
	UpdatedAt      time.Time
	DeletedAt      gorm.DeletedAt `gorm:"index"`
}

// Employee represents employee-specific data
type Employee struct {
	ID          uuid.UUID `gorm:"primaryKey"`
	EmployeeID  string
	Designation string
	User        User
	UserID      uuid.UUID `gorm:"column:user_id"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
	DeletedAt   gorm.DeletedAt `gorm:"index"`
}

// Permission represents a permission entity
type Permission struct {
	ID          uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	Name        string    `gorm:"uniqueIndex;not null"`
	Description string
	CreatedAt   time.Time
	UpdatedAt   time.Time
	DeletedAt   gorm.DeletedAt `gorm:"index"`
}

// Role represents a role entity with permissions
type Role struct {
	ID          uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	Name        string    `gorm:"uniqueIndex;not null"`
	Description string
	IsCustom    bool         `gorm:"default:false"`
	Permissions []Permission `gorm:"many2many:role_permissions;"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
	DeletedAt   gorm.DeletedAt `gorm:"index"`
}

// RefreshToken represents a refresh token for session management
type RefreshToken struct {
	ID        uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	UserID    uuid.UUID
	TokenHash string `gorm:"not null"`
	ExpiresAt time.Time
	IsRevoked bool `gorm:"default:false"`
	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`
}

// AuditLog represents an immutable audit log entry
type AuditLog struct {
	ID         uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	ActorID    uuid.UUID // user_id who performed action
	Action     string    // e.g., "user.create", "role.update"
	TargetType string    // e.g., "user", "role"
	TargetID   uuid.UUID
	OldValue   JSONB // custom JSONB type
	NewValue   JSONB
	Timestamp  time.Time `gorm:"autoCreateTime"`
	CreatedAt  time.Time
	UpdatedAt  time.Time
	// Note: AuditLog typically doesn't have soft delete to maintain integrity
}
