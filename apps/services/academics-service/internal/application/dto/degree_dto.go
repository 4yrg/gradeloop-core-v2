package dto

import (
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
	"github.com/google/uuid"
)

// CreateDegreeRequest is the DTO for creating a new degree under a department.
type CreateDegreeRequest struct {
	Name  string             `json:"name" validate:"required,min=3,max=255"`
	Code  string             `json:"code" validate:"required,min=2,max=50"`
	Level models.DegreeLevel `json:"level" validate:"required,oneof=Undergraduate Postgraduate"`
}

// UpdateDegreeRequest is the DTO for updating a degree's metadata.
type UpdateDegreeRequest struct {
	Name  *string             `json:"name" validate:"omitempty,min=3,max=255"`
	Code  *string             `json:"code" validate:"omitempty,min=2,max=50"`
	Level *models.DegreeLevel `json:"level" validate:"omitempty,oneof=Undergraduate Postgraduate"`
}

// DegreeResponse is the standard DTO for returning degree data.
type DegreeResponse struct {
	ID           uuid.UUID          `json:"id"`
	DepartmentID uuid.UUID          `json:"department_id"`
	Name         string             `json:"name"`
	Code         string             `json:"code"`
	Level        models.DegreeLevel `json:"level"`
	IsActive     bool               `json:"is_active"`
}

func ToDegreeResponse(degree *models.Degree) DegreeResponse {
	return DegreeResponse{
		ID:           degree.ID,
		DepartmentID: degree.DepartmentID,
		Name:         degree.Name,
		Code:         degree.Code,
		Level:        degree.Level,
		IsActive:     degree.IsActive,
	}
}

func ToDegreeListResponse(degrees []models.Degree) []DegreeResponse {
	res := make([]DegreeResponse, len(degrees))
	for i, d := range degrees {
		res[i] = ToDegreeResponse(&d)
	}
	return res
}
