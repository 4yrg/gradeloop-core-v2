package dto

import (
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/assessment/internal/domain"
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
	LanguageID   int        `json:"language_id"`
	Code         string     `json:"code"`
}

// RunCodeRequest is the payload for POST /run-code.
// Executes code without creating a persistent submission.
// AssignmentID is optional — if omitted the enrollment check is skipped.
// This allows instructors to test sample answers before an assignment exists.
type RunCodeRequest struct {
	AssignmentID *uuid.UUID `json:"assignment_id,omitempty"`
	LanguageID   int        `json:"language_id"`
	SourceCode   string     `json:"source_code"`
	Stdin        string     `json:"stdin,omitempty"`
}

// RunCodeResponse is the response for POST /run-code.
// Contains the execution result from Judge0.
type RunCodeResponse struct {
	Stdout        string `json:"stdout"`
	Stderr        string `json:"stderr"`
	CompileOutput string `json:"compile_output"`
	ExecutionTime string `json:"execution_time"`
	MemoryUsed    int    `json:"memory_used"`
	Status        string `json:"status"`
	StatusID      int    `json:"status_id"`
	Message       string `json:"message,omitempty"`
}

// UpdateAnalysisRequest is the payload for PATCH /submissions/:id/analysis.
// It stores the CIPAS AI detection and semantic similarity scores that were
// computed on the frontend at submission time.
type UpdateAnalysisRequest struct {
	AILikelihood            float64  `json:"ai_likelihood"`
	HumanLikelihood         float64  `json:"human_likelihood"`
	IsAIGenerated           bool     `json:"is_ai_generated"`
	AIConfidence            float64  `json:"ai_confidence"`
	SemanticSimilarityScore *float64 `json:"semantic_similarity_score,omitempty"`
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
	LanguageID  int    `json:"language_id,omitempty"`
	Status      string `json:"status"`

	Version  int  `json:"version"`
	IsLatest bool `json:"is_latest"`

	Judge0JobID string    `json:"judge0_job_id,omitempty"`
	SubmittedAt time.Time `json:"submitted_at"`

	// Code is only populated by the GET /submissions/:id/code endpoint.
	Code string `json:"code,omitempty"`

	// Judge0 execution results
	ExecutionStdout   string                  `json:"execution_stdout,omitempty"`
	ExecutionStderr   string                  `json:"execution_stderr,omitempty"`
	CompileOutput     string                  `json:"compile_output,omitempty"`
	ExecutionStatus   string                  `json:"execution_status,omitempty"`
	ExecutionStatusID int                     `json:"execution_status_id,omitempty"`
	ExecutionTime     string                  `json:"execution_time,omitempty"`
	MemoryUsed        int                     `json:"memory_used,omitempty"`
	TestCasesPassed   int                     `json:"test_cases_passed,omitempty"`
	TotalTestCases    int                     `json:"total_test_cases,omitempty"`
	TestCaseResults   []domain.TestCaseResult `json:"test_case_results,omitempty"`

	// CIPAS analysis results
	AILikelihood            *float64   `json:"ai_likelihood,omitempty"`
	HumanLikelihood         *float64   `json:"human_likelihood,omitempty"`
	IsAIGenerated           *bool      `json:"is_ai_generated,omitempty"`
	AIConfidence            *float64   `json:"ai_confidence,omitempty"`
	SemanticSimilarityScore *float64   `json:"semantic_similarity_score,omitempty"`
	AnalyzedAt              *time.Time `json:"analyzed_at,omitempty"`
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

// BatchCodeRequest is the payload for POST /submissions/batch/code.
// Fetches code for multiple submissions in a single call.
type BatchCodeRequest struct {
	SubmissionIDs []string `json:"submission_ids"`
}

// BatchCodeResponse returns a map of submission_id → code data.
type BatchCodeResponse struct {
	Codes map[string]SubmissionCodeResponse `json:"codes"`
	Count int                               `json:"count"`
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

// ─────────────────────────────────────────────────────────────────────────────
// GitHub Integration DTOs
// ─────────────────────────────────────────────────────────────────────────────

type GitHubRepoResponse struct {
	ID           uuid.UUID `json:"id"`
	AssignmentID uuid.UUID `json:"assignment_id"`
	UserID       uuid.UUID `json:"user_id"`
	OrgName      string    `json:"org_name"`
	RepoName     string    `json:"repo_name"`
	RepoURL      string    `json:"repo_url"`
	CloneURL     string    `json:"clone_url"`
	HTMLURL      string    `json:"html_url"`
	LanguageID   int       `json:"language_id"`
	Language     string    `json:"language"`
	CreatedAt    time.Time `json:"created_at"`
}

type GitHubFileResponse struct {
	Name        string `json:"name"`
	Path        string `json:"path"`
	SHA         string `json:"sha"`
	Size        int    `json:"size"`
	Type        string `json:"type"`
	Content     string `json:"content,omitempty"`
	DownloadURL string `json:"download_url,omitempty"`
}

type GitHubCommitRequest struct {
	FilePath string `json:"file_path"`
	Content  string `json:"content"`
	Message  string `json:"message"`
	SHA      string `json:"sha,omitempty"`
}

type GitHubCommitResponse struct {
	Success bool   `json:"success"`
	SHA     string `json:"sha"`
	Message string `json:"message"`
}

type GitHubSubmitRequest struct {
	Message string `json:"message"`
}

type GitHubVersionResponse struct {
	ID            uuid.UUID  `json:"id"`
	GitHubRepoID  uuid.UUID  `json:"github_repo_id"`
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

type ListGitHubVersionsResponse struct {
	Versions []GitHubVersionResponse `json:"versions"`
	Count    int                     `json:"count"`
}

type GitHubConfigRequest struct {
	GitHubOrg       string `json:"github_org"`
	UseGitHub       bool   `json:"use_github"`
	WorkflowFileID  string `json:"workflow_file_id,omitempty"`
	StarterCodeRepo string `json:"starter_code_repo,omitempty"`
}

type GitHubConfigResponse struct {
	GitHubOrg       string `json:"github_org"`
	UseGitHub       bool   `json:"use_github"`
	WorkflowFileID  string `json:"workflow_file_id,omitempty"`
	StarterCodeRepo string `json:"starter_code_repo,omitempty"`
}
