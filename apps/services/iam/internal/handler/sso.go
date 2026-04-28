package handler

import (
	"context"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/config"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/domain"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/service"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/sso"
	"github.com/gofiber/fiber/v3"
)

type SSOHandler struct {
	ssoConfig     *config.SSOConfig
	jitService   *service.JITService
	tenantMapper *service.TenantMapper
	mockProvider *sso.MockProvider
}

// NewSSOHandler creates a new SSO handler
func NewSSOHandler(
	ssoConfig *config.SSOConfig,
	jitService *service.JITService,
	tenantMapper *service.TenantMapper,
) *SSOHandler {
	return &SSOHandler{
		ssoConfig:     ssoConfig,
		jitService:   jitService,
		tenantMapper: tenantMapper,
		mockProvider: sso.NewMockProvider(),
	}
}

// HandleSSOCallback processes SSO callback
func (h *SSOHandler) HandleSSOCallback(c fiber.Ctx) error {
	provider := c.Params("provider")

	// Mock mode
	if h.ssoConfig.IsMockMode() && provider == "mock" {
		return h.handleMockCallback(c)
	}

	// Real mode - redirect to actual IdP (Keycloak, Google, Microsoft, SAML)
	return c.Status(fiber.StatusNotImplemented).JSON(fiber.Map{
		"error": "Real SSO not yet implemented",
	})
}

// handleMockCallback handles mock SSO callback
func (h *SSOHandler) handleMockCallback(c fiber.Ctx) error {
	email := c.Query("email")

	identity, exists := h.mockProvider.ValidateCredentials(email)
	if !exists {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Invalid mock credentials",
			"available_users": h.listMockUsers(),
		})
	}

	// JIT provision
	ctx := context.Background()
	user, err := h.jitService.Provision(ctx, identity)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "Mock SSO login successful",
		"user": fiber.Map{
			"id":       user.ID,
			"email":    user.Email,
			"name":     user.FullName,
			"userType": user.UserType,
			"tenantId": user.TenantID,
		},
	})
}

// listMockUsers returns list of available mock users
func (h *SSOHandler) listMockUsers() []fiber.Map {
	users := h.mockProvider.ListUsers()
	result := make([]fiber.Map, len(users))
	for i, u := range users {
		result[i] = fiber.Map{
			"email": u.Email,
			"name":  u.Name,
			"role":  u.Role,
		}
	}
	return result
}

// HandleSSOInitiate initiates SSO login
func (h *SSOHandler) HandleSSOInitiate(c fiber.Ctx) error {
	provider := c.Params("provider")

	// Mock mode - return available users
	if h.ssoConfig.IsMockMode() && provider == "mock" {
		return c.JSON(fiber.Map{
			"message": "Mock SSO mode - use callback with email query param",
			"available_users": h.listMockUsers(),
		})
	}

	// Real mode
	if h.ssoConfig.IsRealMode() {
		redirectURL := h.getRedirectURL(provider)
		if redirectURL == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Unknown SSO provider",
			})
		}
		return c.JSON(fiber.Map{
			"redirect_url": redirectURL,
		})
	}

	return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
		"error": "SSO is not enabled",
	})
}

// HandleUserInfo returns current SSO user info
func (h *SSOHandler) HandleUserInfo(c fiber.Ctx) error {
	identity, ok := c.Locals("sso_identity").(*domain.SSOIdentity)
	if !ok || identity == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Not authenticated via SSO",
		})
	}

	return c.JSON(identity)
}

// HandleListProviders lists available SSO providers
func (h *SSOHandler) HandleListProviders(c fiber.Ctx) error {
	if h.ssoConfig.IsDisabled() {
		return c.JSON(fiber.Map{
			"enabled": false,
			"mode":    "disabled",
		})
	}

	providers := []fiber.Map{}

	if h.ssoConfig.IsMockMode() {
		providers = append(providers, fiber.Map{
			"name":        "mock",
			"displayName": "Mock SSO (Local Dev)",
			"enabled":     true,
		})
	}

	if h.ssoConfig.GoogleEnabled {
		providers = append(providers, fiber.Map{
			"name":        "google",
			"displayName": "Google Workspace",
			"enabled":     true,
		})
	}

	if h.ssoConfig.MicrosoftEnabled {
		providers = append(providers, fiber.Map{
			"name":        "microsoft",
			"displayName": "Microsoft Entra ID",
			"enabled":     true,
		})
	}

	if h.ssoConfig.SAMLEnabled {
		providers = append(providers, fiber.Map{
			"name":        "saml",
			"displayName": "SAML 2.0",
			"enabled":     true,
		})
	}

	return c.JSON(fiber.Map{
		"enabled":   true,
		"mode":      h.ssoConfig.Mode,
		"providers": providers,
	})
}

// getRedirectURL returns the OAuth redirect URL for provider
func (h *SSOHandler) getRedirectURL(provider string) string {
	switch provider {
	case "google":
		return "https://accounts.google.com/o/oauth2/v2/auth?client_id=" + h.ssoConfig.GoogleClientID
	case "microsoft":
		return "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=" + h.ssoConfig.MicrosoftClientID
	case "keycloak":
		return "/auth/realms/gradeloop-lms/protocol/openid-connect/auth"
	}
	return ""
}