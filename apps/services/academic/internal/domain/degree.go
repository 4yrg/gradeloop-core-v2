package domain

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Degree represents an academic degree under a department
type Degree struct {
	ID           uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	DepartmentID uuid.UUID  `gorm:"type:uuid;not null;index:idx_department_code" json:"department_id"`
	Name         string     `gorm:"type:varchar(255);not null" json:"name"`
	Code         string     `gorm:"type:varchar(50);not null;index:idx_department_code" json:"code"`
	Level        string     `gorm:"type:varchar(50);not null" json:"level"`
	IsActive     bool       `gorm:"default:true" json:"is_active"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	DeletedAt    *time.Time `gorm:"index" json:"deleted_at,omitempty"`

	// Relationships
	Specializations []Specialization `gorm:"foreignKey:DegreeID;constraint:OnDelete:RESTRICT" json:"specializations,omitempty"`
	Department      *Department      `gorm:"foreignKey:DepartmentID;constraint:OnDelete:RESTRICT" json:"department,omitempty"`
}

// TableName specifies the table name for Degree
func (Degree) TableName() string {
	return "degrees"
}

// BeforeCreate hook to generate UUID if not set
func (d *Degree) BeforeCreate(tx *gorm.DB) error {
	if d.ID == uuid.Nil {
		d.ID = uuid.New()
	}
	return nil
}

// Specialization represents a specialization that belongs to a degree
type Specialization struct {
	ID        uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	DegreeID  uuid.UUID  `gorm:"type:uuid;not null;index:idx_degree_code" json:"degree_id"`
	Name      string     `gorm:"type:varchar(255);not null" json:"name"`
	Code      string     `gorm:"type:varchar(50);not null;index:idx_degree_code" json:"code"`
	IsActive  bool       `gorm:"default:true" json:"is_active"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
	DeletedAt *time.Time `gorm:"index" json:"deleted_at,omitempty"`

	// Relationships
	Degree *Degree `gorm:"foreignKey:DegreeID;constraint:OnDelete:RESTRICT" json:"degree,omitempty"`
}

// TableName specifies the table name for Specialization
func (Specialization) TableName() string {
	return "specializations"
}

// BeforeCreate hook to generate UUID if not set
func (s *Specialization) BeforeCreate(tx *gorm.DB) error {
	if s.ID == uuid.Nil {
		s.ID = uuid.New()
	}
	return nil
}
