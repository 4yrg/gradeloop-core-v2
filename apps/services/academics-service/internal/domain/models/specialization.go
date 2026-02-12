package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Specialization represents an optional specialization track within a Degree (e.g., "AI Track", "Software Engineering").
type Specialization struct {
	ID        uuid.UUID      `gorm:"type:uuid;primaryKey"`
	DegreeID  uuid.UUID      `gorm:"type:uuid;not null;index"`
	Name      string         `gorm:"type:varchar(255);not null"`
	Code      string         `gorm:"type:varchar(50);not null"`
	IsActive  bool           `gorm:"not null;default:true"`
	CreatedAt time.Time      `gorm:"not null;default:now()"`
	UpdatedAt time.Time      `gorm:"not null;default:now()"`
	DeletedAt gorm.DeletedAt `gorm:"index"`
	Degree    Degree         `gorm:"foreignKey:DegreeID"`
}

func (s *Specialization) BeforeCreate(tx *gorm.DB) (err error) {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	return
}
