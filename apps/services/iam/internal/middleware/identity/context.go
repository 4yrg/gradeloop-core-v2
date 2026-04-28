package identity

import (
	"time"
)

// Context represents the unified identity model for both environments
type Context struct {
	// Identity
	UserID     string
	Email      string
	Name       string
	GivenName  string
	FamilyName string
	Username   string

	// Tenant (critical for multi-tenancy)
	TenantID string

	// Authorization
	Roles       []string
	Permissions []string

	// Token metadata
	Issuer    string
	SessionID string
	TokenID   string
	ExpiresAt time.Time
	IssuedAt  time.Time

	// Environment
	Environment string // "local" or "production"
}

// ToMap converts identity to map for handlers
func (i *Context) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"user_id":     i.UserID,
		"email":       i.Email,
		"name":        i.Name,
		"given_name":  i.GivenName,
		"family_name": i.FamilyName,
		"username":    i.Username,
		"tenant_id":   i.TenantID,
		"roles":       i.Roles,
		"permissions": i.Permissions,
		"issuer":      i.Issuer,
		"session_id":  i.SessionID,
		"environment": i.Environment,
	}
}

// HasRole checks if user has any of the specified roles
func (i *Context) HasRole(roles ...string) bool {
	for _, role := range roles {
		for _, ur := range i.Roles {
			if role == ur {
				return true
			}
		}
	}
	return false
}

// HasPermission checks if user has any of the specified permissions
func (i *Context) HasPermission(perms ...string) bool {
	for _, perm := range perms {
		for _, up := range i.Permissions {
			if perm == up {
				return true
			}
		}
	}
	return false
}

// IsStudent checks if user is a student
func (i *Context) IsStudent() bool {
	return i.HasRole("student")
}

// IsInstructor checks if user is an instructor
func (i *Context) IsInstructor() bool {
	return i.HasRole("instructor")
}

// IsAdmin checks if user is an admin
func (i *Context) IsAdmin() bool {
	return i.HasRole("admin", "super_admin")
}

// IsSuperAdmin checks if user is a super admin
func (i *Context) IsSuperAdmin() bool {
	return i.HasRole("super_admin")
}

// HasTenantAccess checks if user has access to the specified tenant
func (i *Context) HasTenantAccess(tenantID string) bool {
	// Local environment: dev-university has access to everything
	if i.Environment == "local" && i.TenantID == "dev-university" {
		return true
	}
	return i.TenantID == tenantID
}

// FromContext extracts identity from fiber context
func FromContext(c interface{}) (*Context, bool) {
	// This function is a placeholder for type assertion
	// Actual usage: id, ok := c.Locals("identity").(*identity.Context)
	return nil, false
}
