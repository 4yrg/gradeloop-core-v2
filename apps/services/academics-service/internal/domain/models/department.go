package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Department represents an academic unit within a Faculty (e.g., "Department of Computer Science").
type Department struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey"`
	FacultyID   uuid.UUID      `gorm:"type:uuid;not null;index"`
	Name        string         `gorm:"type:varchar(255);not null"`
	Code        string         `gorm:"type:varchar(50);not null"`
	Description string         `gorm:"type:text"`
	IsActive    bool           `gorm:"not null;default:true"`
	CreatedAt   time.Time      `gorm:"not null;default:now()"`
	UpdatedAt   time.Time      `gorm:"not null;default:now()"`
	DeletedAt   gorm.DeletedAt `gorm:"index"`
	Faculty     Faculty        `gorm:"foreignKey:FacultyID"`
}

func (d *Department) BeforeCreate(tx *gorm.DB) (err error) {
	if d.ID == uuid.Nil {
		d.ID = uuid.New()
	}
	return
}
