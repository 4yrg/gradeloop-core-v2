package domain

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CodeRepo struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	AssignmentID uuid.UUID `gorm:"type:uuid;not null;index"                       json:"assignment_id"`
	UserID       uuid.UUID `gorm:"type:uuid;not null;index"                       json:"user_id"`

	StoragePath string `gorm:"type:varchar(500)" json:"storage_path"`

	LanguageID int    `gorm:"not null;default:71" json:"language_id"`
	Language   string `gorm:"type:varchar(50)"   json:"language"`

	IsActive bool      `gorm:"not null;default:true" json:"is_active"`
	UsedAt   time.Time `json:"used_at"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (CodeRepo) TableName() string { return "code_repos" }

func (c *CodeRepo) BeforeCreate(_ *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	return nil
}

type CodeVersion struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	CodeRepoID   uuid.UUID `gorm:"type:uuid;not null;index"                       json:"code_repo_id"`
	AssignmentID uuid.UUID `gorm:"type:uuid;not null;index"                       json:"assignment_id"`
	UserID       uuid.UUID `gorm:"type:uuid;not null;index"                       json:"user_id"`

	Version       int    `gorm:"not null" json:"version"`
	CommitSHA     string `gorm:"type:varchar(255);not null" json:"commit_sha"`
	CommitMessage string `gorm:"type:text" json:"commit_message"`
	TagName       string `gorm:"type:varchar(255)" json:"tag_name"`

	Grade         *float64   `gorm:"type:decimal(5,2)" json:"grade,omitempty"`
	GradedAt      *time.Time `gorm:"type:timestamp" json:"graded_at,omitempty"`
	GradingStatus string     `gorm:"type:varchar(50);default:'pending'" json:"grading_status"`
	GradingError  string     `gorm:"type:text" json:"grading_error,omitempty"`

	SubmittedAt time.Time `json:"submitted_at"`
	CreatedAt   time.Time `json:"created_at"`
}

func (CodeVersion) TableName() string { return "code_versions" }

func (v *CodeVersion) BeforeCreate(_ *gorm.DB) error {
	if v.ID == uuid.Nil {
		v.ID = uuid.New()
	}
	return nil
}

type AssignmentCodeConfig struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	AssignmentID uuid.UUID `gorm:"type:uuid;not null;uniqueIndex"                 json:"assignment_id"`

	UseSeaweedFS  bool   `gorm:"not null;default:true"  json:"use_seaweedfs"`
	StarterCode   string `gorm:"type:text"              json:"starter_code,omitempty"`
	StarterFiles  string `gorm:"type:text"              json:"starter_files,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (AssignmentCodeConfig) TableName() string { return "assignment_code_configs" }

func (a *AssignmentCodeConfig) BeforeCreate(_ *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return nil
}