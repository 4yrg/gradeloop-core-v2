package dto

import (
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
	"github.com/google/uuid"
)

// CreateDepartmentRequest is the DTO for creating a new department under a faculty.
type CreateDepartmentRequest struct {
	Name        string `json:"name" validate:"required,min=3,max=255"`
	Code        string `json:"code" validate:"required,min=2,max=50"`
	Description string `json:"description"`
}

// UpdateDepartmentRequest is the DTO for updating a department's metadata.
type UpdateDepartmentRequest struct {
	Name        *string `json:"name" validate:"omitempty,min=3,max=255"`
	Code        *string `json:"code" validate:"omitempty,min=2,max=50"`
	Description *string `json:"description"`
}

// DepartmentResponse is the standard DTO for returning department data.
type DepartmentResponse struct {
	ID          uuid.UUID `json:"id"`
	FacultyID   uuid.UUID `json:"faculty_id"`
	Name        string    `json:"name"`
	Code        string    `json:"code"`
	Description string    `json:"description"`
	IsActive    bool      `json:"is_active"`
}

func ToDepartmentResponse(dept *models.Department) DepartmentResponse {
	return DepartmentResponse{
		ID:          dept.ID,
		FacultyID:   dept.FacultyID,
		Name:        dept.Name,
		Code:        dept.Code,
		Description: dept.Description,
		IsActive:    dept.IsActive,
	}
}

func ToDepartmentListResponse(depts []models.Department) []DepartmentResponse {
	res := make([]DepartmentResponse, len(depts))
	for i, d := range depts {
		res[i] = ToDepartmentResponse(&d)
	}
	return res
}
