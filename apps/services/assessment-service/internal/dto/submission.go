package dto

import (
	"time"

	"github.com/google/uuid"
)

// ─────────────────────────────────────────────────────────────────────────────
// Submission Request DTOs
// ─────────────────────────────────────────────────────────────────────────────

// CreateSubmissionRequest is the payload for POST /submissions.
// Exactly one of UserID or GroupID must be provided — both nil or both
// non-nil will be rejected with 400 Bad Request.
type CreateSubmissionRequest struct {
	AssignmentID uuid.UUID  `json:"assignment_id"`
	GroupID      *uuid.UUID `json:"group_id,omitempty"`
	Language     string     `json:"language"`
	Code         string     `json:"code"`
}

// ─────────────────────────────────────────────────────────────────────────────
// Submission Response DTOs
// ─────────────────────────────────────────────────────────────────────────────

// SubmissionResponse is the canonical JSON shape returned to callers for a
// single submission.  The Code field is omitted on metadata-only endpoints and
// populated only by GET /submissions/:id/code.
type SubmissionResponse struct {
	ID           uuid.UUID  `json:"id"`
	AssignmentID uuid.UUID  `json:"assignment_id"`
	UserID       *uuid.UUID `json:"user_id,omitempty"`
	GroupID      *uuid.UUID `json:"group_id,omitempty"`

	StoragePath string `json:"storage_path"`
	Language    string `json:"language"`
	Status      string `json:"status"`

	Version  int  `json:"version"`
	IsLatest bool `json:"is_latest"`

	Judge0JobID string    `json:"judge0_job_id,omitempty"`
	SubmittedAt time.Time `json:"submitted_at"`

	// Code is only populated by the GET /submissions/:id/code endpoint.
	Code string `json:"code,omitempty"`
}

// SubmissionCodeResponse wraps the raw source code returned by
// GET /submissions/:id/code together with identifying metadata.
type SubmissionCodeResponse struct {
	SubmissionID uuid.UUID `json:"submission_id"`
	AssignmentID uuid.UUID `json:"assignment_id"`
	Language     string    `json:"language"`
	Version      int       `json:"version"`
	Code         string    `json:"code"`
}

// ListSubmissionsResponse wraps a slice of SubmissionResponse with a count,
// sorted version-descending (latest first).
type ListSubmissionsResponse struct {
	Submissions []SubmissionResponse `json:"submissions"`
	Count       int                  `json:"count"`
}

// ─────────────────────────────────────────────────────────────────────────────
// Group Request DTOs
// ─────────────────────────────────────────────────────────────────────────────

// CreateGroupRequest is the payload for POST /groups.
// Members must be a non-empty, deduplicated list of user UUID strings.
type CreateGroupRequest struct {
	AssignmentID uuid.UUID `json:"assignment_id"`
	Members      []string  `json:"members"`
}

// ─────────────────────────────────────────────────────────────────────────────
// Group Response DTOs
// ─────────────────────────────────────────────────────────────────────────────

// GroupResponse is the canonical JSON shape for a SubmissionGroup.
type GroupResponse struct {
	ID           uuid.UUID `json:"id"`
	AssignmentID uuid.UUID `json:"assignment_id"`
	Members      []string  `json:"members"`
	CreatedAt    time.Time `json:"created_at"`
}
