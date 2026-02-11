package dto

import (
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
	"github.com/google/uuid"
)

// LeadershipRequest represents a user and their role in a leadership capacity.
type LeadershipRequest struct {
	UserID uuid.UUID `json:"user_id" validate:"required"`
	Role   string    `json:"role" validate:"required,min=2,max=100"`
}

// CreateFacultyRequest is the DTO for creating a new faculty.
type CreateFacultyRequest struct {
	Name        string              `json:"name" validate:"required,min=3,max=255"`
	Code        string              `json:"code" validate:"required,min=2,max=50"`
	Description string              `json:"description"`
	Leaders     []LeadershipRequest `json:"leaders" validate:"required,min=1,dive"`
}

// UpdateFacultyRequest is the DTO for updating a faculty's metadata.
type UpdateFacultyRequest struct {
	Name        string `json:"name" validate:"omitempty,min=3,max=255"`
	Code        string `json:"code" validate:"omitempty,min=2,max=50"`
	Description string `json:"description"`
	IsActive    *bool  `json:"is_active"`
}

// FacultyResponse is the standard DTO for returning faculty data.
type FacultyResponse struct {
	ID          uuid.UUID                  `json:"id"`
	Name        string                     `json:"name"`
	Code        string                     `json:"code"`
	Description string                     `json:"description"`
	IsActive    bool                       `json:"is_active"`
	Leaders     []models.FacultyLeadership `json:"leaders"`
}

func ToFacultyResponse(faculty *models.Faculty) FacultyResponse {
	return FacultyResponse{
		ID:          faculty.ID,
		Name:        faculty.Name,
		Code:        faculty.Code,
		Description: faculty.Description,
		IsActive:    faculty.IsActive,
		Leaders:     faculty.Leaders,
	}
}

func ToFacultyListResponse(faculties []models.Faculty) []FacultyResponse {
	res := make([]FacultyResponse, len(faculties))
	for i, f := range faculties {
		res[i] = ToFacultyResponse(&f)
	}
	return res
}
