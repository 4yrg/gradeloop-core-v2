package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Course struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey"`
	Name        string         `gorm:"not null"`
	Code        string         `gorm:"not null;unique"`
	Description string         `gorm:"type:text"`
	Credits     int            `gorm:"not null;default:0"`
	CreatedAt   time.Time      `gorm:"not null"`
	UpdatedAt   time.Time      `gorm:"not null"`
	DeletedAt   gorm.DeletedAt `gorm:"index"`
}

func (c *Course) BeforeCreate(tx *gorm.DB) (err error) {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return
}

type Semester struct {
	ID        uuid.UUID      `gorm:"type:uuid;primaryKey"`
	Name      string         `gorm:"not null"`
	StartDate time.Time      `gorm:"type:date;not null"`
	EndDate   time.Time      `gorm:"type:date;not null"`
	IsActive  bool           `gorm:"not null;default:true"`
	CreatedAt time.Time      `gorm:"not null"`
	UpdatedAt time.Time      `gorm:"not null"`
	DeletedAt gorm.DeletedAt `gorm:"index"`
}

func (s *Semester) BeforeCreate(tx *gorm.DB) (err error) {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	return
}
