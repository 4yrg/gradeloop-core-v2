package domain

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Tenant represents an organization (university) in the LMS
type Tenant struct {
	ID        uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	Name      string         `gorm:"size:255;not null" json:"name"`
	Slug      string         `gorm:"uniqueIndex;size:50;not null" json:"slug"`
	Domain    string         `gorm:"size:255" json:"domain"`
	KeycloakID string        `gorm:"size:255" json:"keycloak_id"`
	IsActive  bool           `gorm:"default:true" json:"is_active"`
	Settings  string         `gorm:"type:text" json:"settings,omitempty"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName specifies the table name
func (Tenant) TableName() string {
	return "tenants"
}

// IsValidDomain checks if the given domain matches this tenant
func (t *Tenant) IsValidDomain(host string) bool {
	if t.Domain == "" {
		return false
	}
	return host == t.Domain || host == "www."+t.Domain
}

// IsSubdomainOf checks if host is a subdomain of this tenant
func (t *Tenant) IsSubdomainOf(host string) bool {
	if t.Slug == "" {
		return false
	}
	return len(host) > len(t.Slug) && 
		(host[:len(t.Slug)] == t.Slug || 
		 host[:len(t.Slug)+1] == t.Slug+ ".")
}

// Helper to check domain - fixed typo
func (t *Tenant) IsPartOfDomain(host string) bool {
	if t.Domain == "" || t.Slug == "" {
		return false
	}
	// Direct match
	if host == t.Domain || host == "www."+t.Domain {
		return true
	}
	// Subdomain check
	return len(host) > len(t.Slug) && 
		(host[:len(t.Slug)] == t.Slug)
}

// SoftDeleteTenant soft deletes a tenant
func SoftDeleteTenant(db *gorm.DB, tenantID uuid.UUID) error {
	return db.Model(&Tenant{}).
		Where("id = ?", tenantID).
		Update("deleted_at", gorm.Expr("NOW()")).Error
}

// RestoreTenant restores a soft-deleted tenant
func RestoreTenant(db *gorm.DB, tenantID uuid.UUID) error {
	return db.Model(&Tenant{}).
		Unscoped().
		Where("id = ?", tenantID).
		Update("deleted_at", nil).Error
}

// DefaultTenant returns the default tenant for local development
func DefaultTenant() *Tenant {
	return &Tenant{
		ID:        uuid.MustParse("00000000-0000-0000-0000-000000000001"),
		Name:      "Development Tenant",
		Slug:      "dev-university",
		Domain:    "localhost",
		KeycloakID: "gradeloop-lms",
		IsActive:  true,
	}
}

// IsDefault returns true if this is the default dev tenant
func (t *Tenant) IsDefault() bool {
	return t.Slug == "dev-university"
}