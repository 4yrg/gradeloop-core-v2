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
	ID                      uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Email                   string         `gorm:"uniqueIndex;not null" json:"email"`
	FullName                string         `gorm:"not null" json:"full_name"`
	IsActive                bool           `gorm:"default:true" json:"is_active"`
	PasswordHash            string         `gorm:"not null" json:"-"`
	IsPasswordResetRequired bool           `gorm:"default:false" json:"is_password_reset_required"`
	UserType                UserType       `gorm:"type:varchar(20);not null" json:"user_type"`
	CreatedAt               time.Time      `json:"created_at"`
	UpdatedAt               time.Time      `json:"updated_at"`
	DeletedAt               gorm.DeletedAt `gorm:"index" json:"-"`

	// Polymorphic Relations
	Student  *Student  `gorm:"foreignKey:ID" json:"student,omitempty"`
	Employee *Employee `gorm:"foreignKey:ID" json:"employee,omitempty"`
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
