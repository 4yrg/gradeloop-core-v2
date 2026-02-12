package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Batch represents a hierarchical batch/group within a degree program.
// Batches can be nested to model complex cohort structures (e.g., Class → Specialization → Project Team).
type Batch struct {
	ID               uuid.UUID      `gorm:"type:uuid;primaryKey"`
	ParentID         *uuid.UUID     `gorm:"type:uuid;index"`                       // Self-referencing FK for tree hierarchy
	DegreeID         uuid.UUID      `gorm:"type:uuid;not null;index"`              // Required for root batches, inherited for children
	SpecializationID *uuid.UUID     `gorm:"type:uuid;index"`                       // Optional specialization within the degree
	Name             string         `gorm:"type:varchar(255);not null"`            // e.g., "IT Class of 2025"
	Code             string         `gorm:"type:varchar(50);not null;uniqueIndex"` // e.g., "IT2025"
	StartYear        int            `gorm:"not null"`                              // Academic start year
	EndYear          int            `gorm:"not null"`                              // Academic end year
	IsActive         bool           `gorm:"not null;default:true"`                 // Soft deactivation flag
	CreatedAt        time.Time      `gorm:"not null;default:now()"`
	UpdatedAt        time.Time      `gorm:"not null;default:now()"`
	DeletedAt        gorm.DeletedAt `gorm:"index"`

	// Relationships
	Parent         *Batch          `gorm:"foreignKey:ParentID"`
	Children       []Batch         `gorm:"foreignKey:ParentID"`
	Degree         Degree          `gorm:"foreignKey:DegreeID"`
	Specialization *Specialization `gorm:"foreignKey:SpecializationID"`
}

// BeforeCreate hook to generate UUID if not set
func (b *Batch) BeforeCreate(tx *gorm.DB) (err error) {
	if b.ID == uuid.Nil {
		b.ID = uuid.New()
	}
	return
}

// IsRoot returns true if this batch has no parent (root of tree)
func (b *Batch) IsRoot() bool {
	return b.ParentID == nil
}

// TableName specifies the table name for GORM
func (Batch) TableName() string {
	return "batches"
}
