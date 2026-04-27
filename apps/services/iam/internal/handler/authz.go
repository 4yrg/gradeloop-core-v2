package handler

import (
	"encoding/json"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/config"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/domain"
	"github.com/gofiber/fiber/v3"
)

// AuthzHandler handles authorization API
type AuthzHandler struct {
	cfg *config.AuthzConfig
}

// NewAuthzHandler creates a new authz handler
func NewAuthzHandler(cfg *config.AuthzConfig) *AuthzHandler {
	return &AuthzHandler{cfg: cfg}
}

// HandleCheck handles authorization check
func (h *AuthzHandler) HandleCheck(c fiber.Ctx) error {
	var req struct {
		UserID string `json:"user_id"`
		Action string `json:"action"`
		ResourceID string `json:"resource_id"`
		ResourceType string `json:"resource_type"`
	}

	if err := json.Unmarshal(c.Body(), &req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid_request",
			"error_description": err.Error(),
		})
	}

	// Permissive mode - always allow in local
	if h.cfg.IsPermissiveMode() {
		return c.JSON(fiber.Map{
			"allowed": true,
			"reason":  "permissive_mode",
		})
	}

	// Strict mode - check policies (simplified for now)
	return c.JSON(fiber.Map{
		"allowed": true,
		"reason":  "authorized",
	})
}

// HandleAudit handles audit log retrieval
func (h *AuthzHandler) HandleAudit(c fiber.Ctx) error {
	if h.cfg.IsPermissiveMode() {
		// Return mock data in permissive mode
		return c.JSON(fiber.Map{
			"audits": []domain.PolicyAudit{},
		})
	}

	return c.JSON(fiber.Map{
		"audits": []domain.PolicyAudit{},
	})
}

// HandleListPolicies handles policy listing
func (h *AuthzHandler) HandleListPolicies(c fiber.Ctx) error {
	// Return default policies in permissive mode
	if h.cfg.IsPermissiveMode() {
		return c.JSON(fiber.Map{
			"policies": domain.DefaultPolicies(),
		})
	}

	return c.JSON(fiber.Map{
		"policies": []domain.Policy{},
	})
}