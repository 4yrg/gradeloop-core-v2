package models

import (
	"encoding/json"
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
	ID           uuid.UUID      `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Email        string         `gorm:"uniqueIndex;not null" json:"email"`
	FirstName    string         `gorm:"not null" json:"first_name"`
	LastName     string         `gorm:"not null" json:"last_name"`
	IsActive     bool           `gorm:"default:true" json:"is_active"`
	PasswordHash string         `gorm:"not null" json:"-"`
	UserType     UserType       `gorm:"type:varchar(20);check:user_type IN ('student', 'employee')" json:"user_type"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`

	// Virtual field
	FullName string `gorm:"-" json:"full_name"`
}

// AfterFind hook to populate FullName
func (u *User) AfterFind(tx *gorm.DB) (err error) {
	u.FullName = u.FirstName + " " + u.LastName
	return
}

// MarshalJSON custom marshaller to include FullName if not using AfterFind logic explicitly or for broader support
// Although GORM hooks work for DB retrieval, direct struct usage might need this.
// But the requirement says "Implement full_name as a computed JSON field", so MarshalJSON is safer to ensure it's always there in JSON response.
func (u *User) MarshalJSON() ([]byte, error) {
	type Alias User
	return json.Marshal(&struct {
		*Alias
		FullName string `json:"full_name"`
	}{
		Alias:    (*Alias)(u),
		FullName: u.FirstName + " " + u.LastName,
	})
}
