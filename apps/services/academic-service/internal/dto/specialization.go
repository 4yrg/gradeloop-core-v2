package dto

import (
	"time"

	"github.com/google/uuid"
)

// CreateSpecializationRequest represents the request to create a specialization
type CreateSpecializationRequest struct {
	DegreeID uuid.UUID `json:"degree_id" validate:"required"`
	Name     string    `json:"name" validate:"required,min=3,max=255"`
	Code     string    `json:"code" validate:"required,min=1,max=50"`
}

// UpdateSpecializationRequest represents the request to update a specialization
type UpdateSpecializationRequest struct {
	Name     string `json:"name" validate:"omitempty,min=3,max=255"`
	Code     string `json:"code" validate:"omitempty,min=1,max=50"`
	IsActive *bool  `json:"is_active"`
}

// DeactivateSpecializationRequest represents the request body for deactivating a specialization
type DeactivateSpecializationRequest struct {
	IsActive bool `json:"is_active"`
}

// SpecializationResponse represents the response for a specialization
type SpecializationResponse struct {
	ID        uuid.UUID `json:"id"`
	DegreeID  uuid.UUID `json:"degree_id"`
	Name      string    `json:"name"`
	Code      string    `json:"code"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ListSpecializationsQuery represents query parameters for listing specializations
type ListSpecializationsQuery struct {
	IncludeInactive bool `query:"include_inactive"`
}
