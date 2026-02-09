package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Employee struct {
	UserID      uuid.UUID      `gorm:"type:uuid;primaryKey" json:"user_id"`
	User        User           `gorm:"foreignKey:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"user,omitempty"`
	EmployeeID  string         `gorm:"uniqueIndex;not null" json:"employee_id"`
	Department  string         `json:"department"`
	Designation string         `json:"designation"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}
