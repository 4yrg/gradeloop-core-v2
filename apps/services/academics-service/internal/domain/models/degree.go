package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// DegreeLevel represents the academic level of a degree
type DegreeLevel string

const (
	DegreeLevelUndergraduate DegreeLevel = "Undergraduate"
	DegreeLevelPostgraduate  DegreeLevel = "Postgraduate"
)

// Degree represents an academic degree within a Department (e.g., "Bachelor of Science in Information Technology").
type Degree struct {
	ID           uuid.UUID      `gorm:"type:uuid;primaryKey"`
	DepartmentID uuid.UUID      `gorm:"type:uuid;not null;index"`
	Name         string         `gorm:"type:varchar(255);not null"`
	Code         string         `gorm:"type:varchar(50);not null"`
	Level        DegreeLevel    `gorm:"type:degree_level;not null"`
	IsActive     bool           `gorm:"not null;default:true"`
	CreatedAt    time.Time      `gorm:"not null;default:now()"`
	UpdatedAt    time.Time      `gorm:"not null;default:now()"`
	DeletedAt    gorm.DeletedAt `gorm:"index"`
	Department   Department     `gorm:"foreignKey:DepartmentID"`
}

func (d *Degree) BeforeCreate(tx *gorm.DB) (err error) {
	if d.ID == uuid.Nil {
		d.ID = uuid.New()
	}
	return
}
