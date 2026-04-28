package lti

import (
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/config"
	"github.com/gofiber/fiber/v3"
)

// NRPSHandler handles Names & Roles Provisioning Service
type NRPSHandler struct {
	cfg *config.LTIConfig
}

// NewNRPSHandler creates NRPS handler
func NewNRPSHandler(cfg *config.LTIConfig) *NRPSHandler {
	return &NRPSHandler{cfg: cfg}
}

// HandleGetMembers returns roster members
func (h *NRPSHandler) HandleGetMembers(c fiber.Ctx) error {
	contextID := c.Params("context_id")

	// Mock mode: return mock roster
	if h.cfg.IsMockMode() {
		return c.JSON(fiber.Map{
			"id":      contextID + "/members",
			"context": fiber.Map{"id": contextID},
			"members": []fiber.Map{
				{
					"status":  "Active",
					"name":    fiber.Map{"full_name": "Dev Instructor"},
					"email":   "instructor@dev.local",
					"user_id": "dev-instructor-001",
					"roles":   []string{"http://purl.imsglobal.org/vocab/lti/v1/role#Instructor"},
				},
				{
					"status":  "Active",
					"name":    fiber.Map{"full_name": "Dev Student"},
					"email":   "student@dev.local",
					"user_id": "dev-student-001",
					"roles":   []string{"http://purl.imsglobal.org/vocab/lti/v1/role#Learner"},
				},
			},
		})
	}

	return c.JSON(fiber.Map{
		"id":      contextID + "/members",
		"context": fiber.Map{"id": contextID},
		"members": []fiber.Map{},
	})
}
