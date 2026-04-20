package domain

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Department represents an academic department under a faculty
type Department struct {
	ID          uuid.UUID  `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	FacultyID   uuid.UUID  `gorm:"type:uuid;not null;index:idx_faculty_code" json:"faculty_id"`
	Name        string     `gorm:"type:varchar(255);not null" json:"name"`
	Code        string     `gorm:"type:varchar(50);not null;index:idx_faculty_code" json:"code"`
	Description string     `gorm:"type:text" json:"description"`
	IsActive    bool       `gorm:"default:true" json:"is_active"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	DeletedAt   *time.Time `gorm:"index" json:"deleted_at,omitempty"`

	// Relationships
	Faculty *Faculty `gorm:"foreignKey:FacultyID;constraint:OnDelete:RESTRICT" json:"faculty,omitempty"`
}

// TableName specifies the table name for Department
func (Department) TableName() string {
	return "departments"
}

// BeforeCreate hook to generate UUID if not set
func (d *Department) BeforeCreate(tx *gorm.DB) error {
	if d.ID == uuid.Nil {
		d.ID = uuid.New()
	}
	return nil
}
