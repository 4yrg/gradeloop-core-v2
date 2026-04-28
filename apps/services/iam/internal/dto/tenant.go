package dto

import (
	"time"

	"github.com/google/uuid"
)

type CreateTenantRequest struct {
	Name     string `json:"name" validate:"required,min=2,max=255"`
	Slug     string `json:"slug" validate:"required,min=2,max=50,alphanum"`
	Domain   string `json:"domain" validate:"max=255"`
	Settings string `json:"settings"`
}

type UpdateTenantRequest struct {
	Name     *string `json:"name" validate:"omitempty,min=2,max=255"`
	Domain   *string `json:"domain" validate:"omitempty,max=255"`
	IsActive *bool   `json:"is_active"`
	Settings *string `json:"settings"`
}

type TenantResponse struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug"`
	Domain    string    `json:"domain"`
	IsActive  bool      `json:"is_active"`
	Settings  string    `json:"settings,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type TenantListResponse struct {
	Tenants    []TenantResponse `json:"tenants"`
	TotalCount int64            `json:"total_count"`
	Page       int              `json:"page"`
	Limit      int              `json:"limit"`
}

type TenantStatsResponse struct {
	TotalUsers      int64 `json:"total_users"`
	ActiveUsers     int64 `json:"active_users"`
	InactiveUsers   int64 `json:"inactive_users"`
	StudentCount    int64 `json:"student_count"`
	InstructorCount int64 `json:"instructor_count"`
	AdminCount      int64 `json:"admin_count"`
	SuperAdminCount int64 `json:"super_admin_count"`
}