package domain

import (
	"time"
)

// SSOIdentity represents identity from SSO provider
type SSOIdentity struct {
	// From IdP
	Provider   string `json:"provider"`   // "google", "microsoft", "saml", "keycloak", "mock"
	ProviderID string `json:"provider_id"` // Unique ID from IdP
	Email      string `json:"email"`
	Name       string `json:"name"`
	GivenName  string `json:"given_name"`
	FamilyName string `json:"family_name"`
	AvatarURL  string `json:"avatar_url"`

	// Tenant resolution
	TenantID string `json:"tenant_id"`

	// Role (for mock)
	Role string `json:"role"`

	// Raw claims (for debugging)
	RawClaims map[string]interface{} `json:"raw_claims,omitempty"`

	// Timestamps
	IssuedAt time.Time `json:"issued_at"`
}

// IsValid returns true if the identity has minimum required fields
func (s *SSOIdentity) IsValid() bool {
	return s.Email != "" && s.Provider != ""
}

// GetDisplayName returns the best available display name
func (s *SSOIdentity) GetDisplayName() string {
	if s.Name != "" {
		return s.Name
	}
	if s.GivenName != "" {
		if s.FamilyName != "" {
			return s.GivenName + " " + s.FamilyName
		}
		return s.GivenName
	}
	return s.Email
}

// ToUser creates a domain.User from SSOIdentity
func (s *SSOIdentity) ToUser() *User {
	return &User{
		Email:        s.Email,
		FullName:     s.GetDisplayName(),
		AvatarURL:    s.AvatarURL,
		UserType:     s.Role,
		EmailVerified: true,
	}
}
