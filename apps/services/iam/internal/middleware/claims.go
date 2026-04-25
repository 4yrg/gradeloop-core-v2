package middleware

import (
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/middleware/identity"
	"github.com/golang-jwt/jwt/v5"
)

// KeycloakClaims represents claims from Keycloak JWT token
type KeycloakClaims struct {
	Sub               string `json:"sub"`
	Iss               string `json:"iss"`
	Aud               any    `json:"aud"`
	TenantID          string `json:"tenant_id"`
	Email             string `json:"email"`
	Name              string `json:"name"`
	GivenName         string `json:"given_name"`
	FamilyName        string `json:"family_name"`
	PreferredUsername string `json:"preferred_username"`
	EmailVerified    bool   `json:"email_verified"`
	Roles             []string `json:"https://gradeloop.edu/claims/roles"`
	Permissions      []string `json:"https://gradeloop.edu/claims/permissions"`
	SessionState     string `json:"session_state"`
	jwt.RegisteredClaims
}

// ToIdentity converts KeycloakClaims to identity.Context
func (kc *KeycloakClaims) ToIdentity(environment string) *identity.Context {
	// Resolve roles
	roles := kc.Roles
	if roles == nil {
		roles = []string{}
	}

	// Resolve permissions
	perms := kc.Permissions
	if perms == nil {
		perms = []string{}
	}

	return &identity.Context{
		UserID:       kc.Sub,
		Email:        kc.Email,
		Name:        kc.Name,
		GivenName:   kc.GivenName,
		FamilyName:  kc.FamilyName,
		Username:   kc.PreferredUsername,
		Roles:      roles,
		Permissions: perms,
		Issuer:     kc.Issuer,
		SessionID:  kc.SessionState,
		TokenID:    kc.ID,
		Environment: environment,
		ExpiresAt:  kc.ExpiresAt.Time,
		IssuedAt:   kc.IssuedAt.Time,
	}
}