package lti

import (
	"fmt"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/config"
	"github.com/gofiber/fiber/v3"
)

// LoginInitiationHandler handles OIDC login initiation
type LoginInitiationHandler struct {
	cfg *config.LTIConfig
}

// NewLoginInitiationHandler creates login initiation handler
func NewLoginInitiationHandler(cfg *config.LTIConfig) *LoginInitiationHandler {
	return &LoginInitiationHandler{cfg: cfg}
}

// HandleLoginInitiation processes LTI login initiation
func (h *LoginInitiationHandler) HandleLoginInitiation(c fiber.Ctx) error {
	iss := c.Query("iss")
	loginHint := c.Query("login_hint")
	targetLinkURI := c.Query("target_link_uri")

	if iss == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":             "invalid_request",
			"error_description": "Missing iss parameter",
		})
	}

	// Mock mode: simplified response
	if h.cfg.IsMockMode() {
		return c.JSON(fiber.Map{
			"status":     "mock_mode",
			"login_hint": loginHint,
			"target_uri": targetLinkURI,
			"issuer":     iss,
		})
	}

	state := fmt.Sprintf("lti-state-%d", time.Now().UnixNano())

	// Just return response, don't redirect
	return c.JSON(fiber.Map{
		"redirect_url": h.cfg.RedirectURI + "?state=" + state,
		"state":        state,
	})
}

// LTILaunchHandler handles LTI launch
type LTILaunchHandler struct {
	cfg *config.LTIConfig
}

// NewLTILaunchHandler creates launch handler
func NewLTILaunchHandler(cfg *config.LTIConfig) *LTILaunchHandler {
	return &LTILaunchHandler{cfg: cfg}
}

// HandleLaunch processes LTI launch (POST)
func (h *LTILaunchHandler) HandleLaunch(c fiber.Ctx) error {
	idToken := c.FormValue("id_token")

	if idToken == "" {
		// LTI 1.1 fallback - just return mock response for now
		if h.cfg.LTI11Enabled {
			return c.JSON(fiber.Map{
				"status": "legacy_launch",
				"mode":   "lti1.1",
			})
		}
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":             "invalid_request",
			"error_description": "Missing id_token",
		})
	}

	// Mock mode: simplified validation
	if h.cfg.IsMockMode() {
		return c.JSON(fiber.Map{
			"status":  "launch_ok",
			"message": "LTI 1.3 launch successful (mock)",
		})
	}

	return c.JSON(fiber.Map{
		"status":  "launch_ok",
		"message": "LTI launch processed",
	})
}

// LTIJWTHandler handles JWKS
type LTIJWTHandler struct{}

// NewLTIJWTHandler creates JWT handler
func NewLTIJWTHandler() *LTIJWTHandler {
	return &LTIJWTHandler{}
}

// HandleJWKS returns empty JWKS
func (h *LTIJWTHandler) HandleJWKS(c fiber.Ctx) error {
	return c.JSON(fiber.Map{"keys": []string{}})
}
