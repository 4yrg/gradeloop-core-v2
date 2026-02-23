package dto

import (
	"time"

	"github.com/google/uuid"
)

// CreateDegreeRequest represents the payload to create a new degree
type CreateDegreeRequest struct {
	DepartmentID uuid.UUID `json:"department_id" validate:"required"`
	Name         string    `json:"name" validate:"required,min=3,max=255"`
	Code         string    `json:"code" validate:"required,min=2,max=50"`
	Level        string    `json:"level" validate:"required,oneof=Undergraduate Postgraduate Doctoral Diploma Certificate"`
}

// UpdateDegreeRequest represents the payload to update an existing degree
// Note: DepartmentID cannot be changed via update.
type UpdateDegreeRequest struct {
	Name     string `json:"name" validate:"omitempty,min=3,max=255"`
	Code     string `json:"code" validate:"omitempty,min=2,max=50"`
	Level    string `json:"level" validate:"omitempty,oneof=Undergraduate Postgraduate Doctoral Diploma Certificate"`
	IsActive *bool  `json:"is_active"`
}

// DeactivateDegreeRequest represents the request body for deactivating a degree
type DeactivateDegreeRequest struct {
	IsActive bool `json:"is_active"`
}

// DegreeResponse is returned for degree-related endpoints
type DegreeResponse struct {
	ID           uuid.UUID `json:"id"`
	DepartmentID uuid.UUID `json:"department_id"`

	Name     string `json:"name"`
	Code     string `json:"code"`
	Level    string `json:"level"`
	IsActive bool   `json:"is_active"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ListDegreesQuery represents query parameters for listing degrees
type ListDegreesQuery struct {
	IncludeInactive bool `query:"include_inactive"`
}
