package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Faculty represents a top-level academic division (e.g., "Faculty of Engineering").
type Faculty struct {
	ID          uuid.UUID           `gorm:"type:uuid;primaryKey"`
	Name        string              `gorm:"type:varchar(255);unique;not null"`
	Code        string              `gorm:"type:varchar(50);unique;not null"`
	Description string              `gorm:"type:text"`
	IsActive    bool                `gorm:"not null;default:true"`
	CreatedAt   time.Time           `gorm:"not null;default:now()"`
	UpdatedAt   time.Time           `gorm:"not null;default:now()"`
	DeletedAt   gorm.DeletedAt      `gorm:"index"`
	Leaders     []FacultyLeadership `gorm:"foreignKey:FacultyID"`
}

// FacultyLeadership maps a User from the IAM service to a leadership role in a Faculty.
type FacultyLeadership struct {
	FacultyID uuid.UUID `gorm:"primaryKey"`
	UserID    uuid.UUID `gorm:"primaryKey"`
	Role      string    `gorm:"type:varchar(100);not null"`
	IsActive  bool      `gorm:"not null;default:true"`
	CreatedAt time.Time `gorm:"not null;default:now()"`
	UpdatedAt time.Time `gorm:"not null;default:now()"`
}

func (f *Faculty) BeforeCreate(tx *gorm.DB) (err error) {
	if f.ID == uuid.Nil {
		f.ID = uuid.New()
	}
	return
}
