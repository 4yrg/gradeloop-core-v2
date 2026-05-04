package domain

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type GitHubRepo struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	AssignmentID uuid.UUID `gorm:"type:uuid;not null;index"                       json:"assignment_id"`
	UserID       uuid.UUID `gorm:"type:uuid;not null;index"                       json:"user_id"`

	OrgName   string `gorm:"type:varchar(255);not null" json:"org_name"`
	RepoName  string `gorm:"type:varchar(255);not null" json:"repo_name"`
	RepoURL   string `gorm:"type:varchar(500)"          json:"repo_url"`
	CloneURL  string `gorm:"type:varchar(500)"          json:"clone_url"`
	HTMLURL   string `gorm:"type:varchar(500)"          json:"html_url"`

	LanguageID int       `gorm:"not null;default:71" json:"language_id"`
	Language   string    `gorm:"type:varchar(50)"   json:"language"`

	IsActive bool      `gorm:"not null;default:true" json:"is_active"`
	UsedAt   time.Time `json:"used_at"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (GitHubRepo) TableName() string { return "github_repos" }

func (g *GitHubRepo) BeforeCreate(_ *gorm.DB) error {
	if g.ID == uuid.Nil {
		g.ID = uuid.New()
	}
	return nil
}

type GitHubSubmissionVersion struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	GitHubRepoID uuid.UUID `gorm:"type:uuid;not null;index"                       json:"github_repo_id"`
	AssignmentID uuid.UUID `gorm:"type:uuid;not null;index"                       json:"assignment_id"`
	UserID       uuid.UUID `gorm:"type:uuid;not null;index"                       json:"user_id"`

	Version     int       `gorm:"not null" json:"version"`
	CommitSHA   string    `gorm:"type:varchar(255);not null" json:"commit_sha"`
	CommitMessage string  `gorm:"type:text" json:"commit_message"`
	TagName     string    `gorm:"type:varchar(255)" json:"tag_name"`

	Grade         *float64 `gorm:"type:decimal(5,2)" json:"grade,omitempty"`
	GradedAt      *time.Time `gorm:"type:timestamp" json:"graded_at,omitempty"`
	GradingStatus string    `gorm:"type:varchar(50);default:'pending'" json:"grading_status"`
	GradingError  string    `gorm:"type:text" json:"grading_error,omitempty"`

	SubmittedAt time.Time `json:"submitted_at"`
	CreatedAt   time.Time `json:"created_at"`
}

func (GitHubSubmissionVersion) TableName() string { return "github_submission_versions" }

func (v *GitHubSubmissionVersion) BeforeCreate(_ *gorm.DB) error {
	if v.ID == uuid.Nil {
		v.ID = uuid.New()
	}
	return nil
}

type AssignmentGitHubConfig struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	AssignmentID uuid.UUID `gorm:"type:uuid;not null;uniqueIndex"                 json:"assignment_id"`

	GitHubOrg       string `gorm:"type:varchar(255);not null" json:"github_org"`
	UseGitHub       bool   `gorm:"not null;default:false"    json:"use_github"`
	WorkflowFileID  string `gorm:"type:varchar(255)"          json:"workflow_file_id,omitempty"`
	StarterCodeRepo string `gorm:"type:varchar(255)"          json:"starter_code_repo,omitempty"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (AssignmentGitHubConfig) TableName() string { return "assignment_github_configs" }

func (a *AssignmentGitHubConfig) BeforeCreate(_ *gorm.DB) error {
	if a.ID == uuid.Nil {
		a.ID = uuid.New()
	}
	return nil
}