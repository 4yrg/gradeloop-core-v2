package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Student struct {
	UserID         uuid.UUID      `gorm:"type:uuid;primaryKey" json:"user_id"`
	User           User           `gorm:"foreignKey:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"user,omitempty"`
	StudentRegNo   string         `gorm:"uniqueIndex;not null" json:"student_reg_no"`
	EnrollmentDate time.Time      `json:"enrollment_date"`
	Faculty        string         `json:"faculty"`
	Department     string         `json:"department"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}
