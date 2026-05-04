package dto

import (
	"time"

	"github.com/google/uuid"
)

type CodeRepoResponse struct {
	ID           uuid.UUID `json:"id"`
	AssignmentID uuid.UUID `json:"assignment_id"`
	UserID       uuid.UUID `json:"user_id"`
	StoragePath  string    `json:"storage_path"`
	LanguageID   int       `json:"language_id"`
	Language     string    `json:"language"`
	CreatedAt    time.Time `json:"created_at"`
}

type CodeFileResponse struct {
	Name     string `json:"name"`
	Path     string `json:"path"`
	SHA      string `json:"sha"`
	Size     int64  `json:"size"`
	Type     string `json:"type"`
	Content  string `json:"content,omitempty"`
	IsFolder bool   `json:"is_folder"`
}

type CodeSaveFileRequest struct {
	FilePath string `json:"file_path"`
	Content  string `json:"content"`
	Message  string `json:"message"`
	SHA      string `json:"sha,omitempty"`
}

type CodeCommitResponse struct {
	Success bool      `json:"success"`
	SHA     string    `json:"sha"`
	Message string    `json:"message"`
	Author  string    `json:"author,omitempty"`
	Date    time.Time `json:"date,omitempty"`
}

type CodeVersionResponse struct {
	ID            uuid.UUID  `json:"id"`
	CodeRepoID    uuid.UUID  `json:"code_repo_id"`
	AssignmentID  uuid.UUID  `json:"assignment_id"`
	UserID        uuid.UUID  `json:"user_id"`
	Version       int        `json:"version"`
	CommitSHA     string     `json:"commit_sha"`
	CommitMessage string     `json:"commit_message"`
	TagName       string     `json:"tag_name"`
	Grade         *float64   `json:"grade,omitempty"`
	GradedAt      *time.Time `json:"graded_at,omitempty"`
	GradingStatus string     `json:"grading_status"`
	GradingError  string     `json:"grading_error,omitempty"`
	SubmittedAt   time.Time  `json:"submitted_at"`
}

type CodeSubmitRequest struct {
	Message string `json:"message"`
}

type CodeConfigResponse struct {
	UseSeaweedFS bool   `json:"use_seaweedfs"`
	StarterCode  string `json:"starter_code"`
}

type CodeConfigRequest struct {
	UseSeaweedFS bool   `json:"use_seaweedfs"`
	StarterCode  string `json:"starter_code"`
}
