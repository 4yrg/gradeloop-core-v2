package dto

import (
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
	"github.com/google/uuid"
)

// CreateSpecializationRequest is the DTO for creating a new specialization under a degree.
type CreateSpecializationRequest struct {
	Name string `json:"name" validate:"required,min=3,max=255"`
	Code string `json:"code" validate:"required,min=2,max=50"`
}

// UpdateSpecializationRequest is the DTO for updating a specialization's metadata.
type UpdateSpecializationRequest struct {
	Name *string `json:"name" validate:"omitempty,min=3,max=255"`
	Code *string `json:"code" validate:"omitempty,min=2,max=50"`
}

// SpecializationResponse is the standard DTO for returning specialization data.
type SpecializationResponse struct {
	ID       uuid.UUID `json:"id"`
	DegreeID uuid.UUID `json:"degree_id"`
	Name     string    `json:"name"`
	Code     string    `json:"code"`
	IsActive bool      `json:"is_active"`
}

func ToSpecializationResponse(specialization *models.Specialization) SpecializationResponse {
	return SpecializationResponse{
		ID:       specialization.ID,
		DegreeID: specialization.DegreeID,
		Name:     specialization.Name,
		Code:     specialization.Code,
		IsActive: specialization.IsActive,
	}
}

func ToSpecializationListResponse(specializations []models.Specialization) []SpecializationResponse {
	res := make([]SpecializationResponse, len(specializations))
	for i, s := range specializations {
		res[i] = ToSpecializationResponse(&s)
	}
	return res
}
