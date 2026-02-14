package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UserType string

const (
	UserTypeStudent  UserType = "student"
	UserTypeEmployee UserType = "employee"
)

type User struct {
	ID                      uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	Email                   string         `gorm:"uniqueIndex;not null" json:"email"`
	FullName                string         `gorm:"not null" json:"full_name"`
	IsActive                bool           `gorm:"default:true" json:"is_active"`
	PasswordHash            string         `gorm:"not null" json:"-"`
	IsPasswordResetRequired bool           `gorm:"default:false" json:"is_password_reset_required"`
	PasswordSetAt           *time.Time     `json:"password_set_at"`
	PasswordChangedAt       *time.Time     `json:"password_changed_at"`
	ActivationTokenID       *uuid.UUID     `gorm:"type:uuid" json:"activation_token_id"`
	UserType                UserType       `gorm:"type:varchar(20);not null" json:"user_type"`
	CreatedAt               time.Time      `json:"created_at"`
	UpdatedAt               time.Time      `json:"updated_at"`
	DeletedAt               gorm.DeletedAt `gorm:"index" json:"-"`

	// Polymorphic Relations
	Student  *Student  `gorm:"foreignKey:ID" json:"student,omitempty"`
	Employee *Employee `gorm:"foreignKey:ID" json:"employee,omitempty"`
	Roles    []Role    `gorm:"many2many:users_roles;" json:"roles"`
}

// RefreshToken stores refresh tokens for user sessions
type RefreshToken struct {
	ID         uuid.UUID  `gorm:"column:id;type:uuid;primaryKey" json:"id"`
	UserID     uuid.UUID  `gorm:"column:user_id;type:uuid;not null;index" json:"user_id"`
	TokenHash  string     `gorm:"column:token_hash;not null;uniqueIndex" json:"-"` // Hashed token for lookup
	Expiry     time.Time  `gorm:"column:expires_at;not null;index" json:"expires_at"`
	RevokedAt  *time.Time `gorm:"column:revoked_at;index" json:"revoked_at,omitempty"`
	IsActive   bool       `gorm:"column:is_active;default:true;index" json:"is_active"`
	IsUsed     bool       `gorm:"column:is_used;default:false" json:"is_used"` // For replay attack detection
	CreatedAt  time.Time  `gorm:"column:created_at" json:"created_at"`
	UpdatedAt  time.Time  `gorm:"column:updated_at" json:"updated_at"`
	LastUsedAt *time.Time `gorm:"column:last_used_at" json:"last_used_at,omitempty"`
}

func (u *User) BeforeCreate(tx *gorm.DB) (err error) {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return
}

func (rt *RefreshToken) BeforeCreate(tx *gorm.DB) (err error) {
	if rt.ID == uuid.Nil {
		rt.ID = uuid.New()
	}
	return
}

// Student Subtype
type Student struct {
	ID             uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	EnrollmentDate time.Time `json:"enrollment_date"`
	StudentRegNo   string    `gorm:"uniqueIndex;not null" json:"student_reg_no"`
}

// Employee Subtype
type Employee struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	EmployeeID   string    `gorm:"uniqueIndex;not null" json:"employee_id"`
	Designation  string    `json:"designation"`
	EmployeeType string    `json:"employee_type"`
}
