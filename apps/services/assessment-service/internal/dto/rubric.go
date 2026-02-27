package dto

import (
	"time"

	"github.com/google/uuid"
)

// ─────────────────────────────────────────────────────────────────────────────
// Rubric Request DTOs
// ─────────────────────────────────────────────────────────────────────────────

// CreateRubricRequest is the payload for POST /assignments/:id/rubric
type CreateRubricRequest struct {
	Execution  ExecutionConfigDTO   `json:"execution"`
	Dimensions []RubricDimensionDTO `json:"dimensions"`
}

// UpdateRubricRequest is the payload for PATCH /assignments/:id/rubric
// Only dimension weights and descriptions can be updated (execution is fixed)
type UpdateRubricRequest struct {
	Dimensions []RubricDimensionDTO `json:"dimensions"`
}

// InstructorOverrideRequest is the payload for PATCH /evaluations/:id/override
type InstructorOverrideRequest struct {
	AdjustedScore int    `json:"adjusted_score"`
	Reason        string `json:"reason"`
}

// ─────────────────────────────────────────────────────────────────────────────
// Rubric Component DTOs
// ─────────────────────────────────────────────────────────────────────────────

// ExecutionConfigDTO represents the deterministic execution scoring configuration
// Execution weight is fixed at 30% per ACAFS Blueprint standards
type ExecutionConfigDTO struct {
	Weight    int      `json:"weight"`
	Fixed     bool     `json:"fixed"`
	TestCases []string `json:"test_cases,omitempty"`
}

// RubricDimensionDTO represents a single semantic evaluation dimension
type RubricDimensionDTO struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Weight      int    `json:"weight"`
	Description string `json:"description"`
}

// RubricConfigDTO represents the complete rubric configuration
type RubricConfigDTO struct {
	Execution  ExecutionConfigDTO   `json:"execution"`
	Dimensions []RubricDimensionDTO `json:"dimensions"`
}

// ─────────────────────────────────────────────────────────────────────────────
// Rubric Response DTOs
// ─────────────────────────────────────────────────────────────────────────────

// RubricResponse is the canonical JSON shape returned for rubric configuration
type RubricResponse struct {
	AssignmentID   uuid.UUID            `json:"assignment_id"`
	Execution      ExecutionConfigDTO   `json:"execution"`
	Dimensions     []RubricDimensionDTO `json:"dimensions"`
	Version        int                  `json:"version"`
	TotalWeight    int                  `json:"total_weight"`
	CreatedAt      time.Time            `json:"created_at"`
	UpdatedAt      time.Time            `json:"updated_at"`
}

// RubricVersionResponse represents a single rubric version in history
type RubricVersionResponse struct {
	Version     int                  `json:"version"`
	Execution   ExecutionConfigDTO   `json:"execution"`
	Dimensions  []RubricDimensionDTO `json:"dimensions"`
	CreatedAt   time.Time            `json:"created_at"`
}

// RubricVersionsResponse wraps a list of rubric versions
type RubricVersionsResponse struct {
	Versions []RubricVersionResponse `json:"versions"`
	Count    int                     `json:"count"`
}

// ─────────────────────────────────────────────────────────────────────────────
// Criteria Breakdown DTOs
// ─────────────────────────────────────────────────────────────────────────────

// CriteriaBreakdownResponse represents the scoring breakdown per dimension
type CriteriaBreakdownResponse struct {
	Execution               int `json:"execution"`
	LogicalCorrectness      int `json:"logical_correctness"`
	BestPractices           int `json:"best_practices"`
	CodeQuality             int `json:"code_quality"`
	ConceptualUnderstanding int `json:"conceptual_understanding"`
}

// InstructorOverrideResponse represents a manual score adjustment
type InstructorOverrideResponse struct {
	AdjustedScore int       `json:"adjusted_score"`
	Reason        string    `json:"reason"`
	OverriddenBy  string    `json:"overridden_by"`
	OverriddenAt  time.Time `json:"overridden_at"`
	OriginalScore int       `json:"original_score"`
}

// EvaluationResponse represents the complete evaluation result with rubric scoring
type EvaluationResponse struct {
	SubmissionID        uuid.UUID                   `json:"submission_id"`
	AssignmentID        uuid.UUID                   `json:"assignment_id"`
	CriteriaBreakdown   CriteriaBreakdownResponse   `json:"criteria_breakdown"`
	TotalScore          int                         `json:"total_score"`
	RubricVersionID     int                         `json:"rubric_version_id"`
	InstructorOverride  *InstructorOverrideResponse `json:"instructor_override,omitempty"`
	EvaluatedAt         time.Time                   `json:"evaluated_at"`
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation Constants
// ─────────────────────────────────────────────────────────────────────────────

const (
	// FixedExecutionWeight is the immutable weight for Code Execution (30%)
	FixedExecutionWeight = 30
	// TotalRubricWeight is the expected sum of all weights (100%)
	TotalRubricWeight = 100
	// MinDimensionWeight is the minimum allowed weight for a dimension
	MinDimensionWeight = 0
	// MaxDimensionWeight is the maximum allowed weight for a dimension
	MaxDimensionWeight = 70
)

// ValidDimensionIDs contains the allowed semantic dimension identifiers
var ValidDimensionIDs = []string{
	"logical_correctness",
	"best_practices",
	"code_quality",
	"conceptual_understanding",
}

// IsValidDimensionID checks if a dimension ID is valid
func IsValidDimensionID(id string) bool {
	for _, validID := range ValidDimensionIDs {
		if id == validID {
			return true
		}
	}
	return false
}
