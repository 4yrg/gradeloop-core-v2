package dto

import (
	"time"

	"github.com/google/uuid"
)

// CreateDepartmentRequest represents the request to create a department
type CreateDepartmentRequest struct {
	FacultyID   uuid.UUID `json:"faculty_id" validate:"required"`
	Name        string    `json:"name" validate:"required,min=3,max=255"`
	Code        string    `json:"code" validate:"required,min=2,max=50"`
	Description string    `json:"description"`
}

// UpdateDepartmentRequest represents the request to update a department
type UpdateDepartmentRequest struct {
	Name        string `json:"name" validate:"omitempty,min=3,max=255"`
	Code        string `json:"code" validate:"omitempty,min=2,max=50"`
	Description string `json:"description"`
	IsActive    *bool  `json:"is_active"`
}

// DeactivateDepartmentRequest represents the request to deactivate a department
type DeactivateDepartmentRequest struct {
	IsActive bool `json:"is_active"`
}

// DepartmentResponse represents the response for a department
type DepartmentResponse struct {
	ID          uuid.UUID `json:"id"`
	FacultyID   uuid.UUID `json:"faculty_id"`
	Name        string    `json:"name"`
	Code        string    `json:"code"`
	Description string    `json:"description"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// ListDepartmentsQuery represents query parameters for listing departments
type ListDepartmentsQuery struct {
	IncludeInactive bool `query:"include_inactive"`
}
