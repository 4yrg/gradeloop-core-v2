package config

import (
	"github.com/4yrg/gradeloop-core-v2/packages/go/env"
)

// SSOConfig holds SSO configuration
type SSOConfig struct {
	// Mode: "mock", "real", or "disabled"
	Mode string

	// Allow local Keycloak login
	AllowLocal bool

	// Google Workspace OIDC
	GoogleEnabled      bool
	GoogleClientID     string
	GoogleClientSecret string

	// Microsoft Entra ID (Azure AD)
	MicrosoftEnabled      bool
	MicrosoftClientID     string
	MicrosoftClientSecret string

	// SAML 2.0
	SAMLEnabled     bool
	SAMLMetadataURL string

	// JIT Provisioning
	JITEnabled  bool
	DefaultRole string
}

// LoadSSOConfig loads SSO configuration from environment
func LoadSSOConfig() *SSOConfig {
	env.Load()

	mode := getEnvString("SSO_MODE", "disabled")

	// If disabled, return minimal config
	if mode == "disabled" {
		return &SSOConfig{
			Mode:       "disabled",
			AllowLocal: false,
			JITEnabled: false,
		}
	}

	// Determine if local is allowed
	allowLocal := getEnvString("SSO_ALLOW_LOCAL", "true") == "true"

	return &SSOConfig{
		Mode:       mode,
		AllowLocal: allowLocal,

		// Google Workspace
		GoogleEnabled:      getEnvString("GOOGLE_CLIENT_ID", "") != "",
		GoogleClientID:     getEnvString("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: getEnvString("GOOGLE_CLIENT_SECRET", ""),

		// Microsoft Entra ID
		MicrosoftEnabled:      getEnvString("MICROSOFT_CLIENT_ID", "") != "",
		MicrosoftClientID:     getEnvString("MICROSOFT_CLIENT_ID", ""),
		MicrosoftClientSecret: getEnvString("MICROSOFT_CLIENT_SECRET", ""),

		// SAML
		SAMLEnabled:     getEnvString("SAML_IDP_METADATA_URL", "") != "",
		SAMLMetadataURL: getEnvString("SAML_IDP_METADATA_URL", ""),

		// JIT
		JITEnabled:  getEnvString("SSO_JIT_ENABLED", "true") == "true",
		DefaultRole: getEnvString("SSO_DEFAULT_ROLE", "student"),
	}
}

// IsDisabled returns true if SSO is completely disabled
func (s *SSOConfig) IsDisabled() bool {
	return s.Mode == "disabled"
}

// IsMockMode returns true if mock SSO is enabled
func (s *SSOConfig) IsMockMode() bool {
	return s.Mode == "mock"
}

// IsRealMode returns true if real SSO is enabled
func (s *SSOConfig) IsRealMode() bool {
	return s.Mode == "real"
}

// HasAnyProvider returns true if any SSO provider is configured
func (s *SSOConfig) HasAnyProvider() bool {
	return s.GoogleEnabled || s.MicrosoftEnabled || s.SAMLEnabled
}
