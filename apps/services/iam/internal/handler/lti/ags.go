package lti

import (
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/config"
	"github.com/gofiber/fiber/v3"
)

// AGSHandler handles Assignment & Grade Service
type AGSHandler struct {
	cfg *config.LTIConfig
}

// NewAGSHandler creates AGS handler
func NewAGSHandler(cfg *config.LTIConfig) *AGSHandler {
	return &AGSHandler{cfg: cfg}
}

// HandleListLineItems lists line items
func (h *AGSHandler) HandleListLineItems(c fiber.Ctx) error {
	if h.cfg.IsMockMode() {
		return c.JSON(fiber.Map{
			"lineItems": []fiber.Map{
				{
					"id":          "mock-lineitem-1",
					"scoreMaximum": 100.0,
					"label":      "Quiz 1",
					"resourceId": "quiz-1",
				},
				{
					"id":          "mock-lineitem-2",
					"scoreMaximum": 100.0,
					"label":      "Assignment 1",
					"resourceId": "assignment-1",
				},
			},
		})
	}

	return c.JSON(fiber.Map{"lineItems": []fiber.Map{}})
}

// HandleCreateLineItem creates line item
func (h *AGSHandler) HandleCreateLineItem(c fiber.Ctx) error {
	var req struct {
		Label string  `json:"label"`
		ScoreMax float64 `json:"scoreMaximum"`
	}

	// Parse will be done by caller in production
	label := c.Locals("label")
	if label != nil {
		req.Label = label.(string)
	}
	scoreMax := c.Locals("scoreMax")
	if scoreMax != nil {
		req.ScoreMax = scoreMax.(float64)
	}

	if req.Label == "" {
		req.Label = "Untitled"
	}
	if req.ScoreMax == 0 {
		req.ScoreMax = 100
	}

	return c.JSON(fiber.Map{
		"id":                  "new-" + time.Now().Format("20060102150405"),
		"label":               req.Label,
		"scoreMaximum":        req.ScoreMax,
		"scoreMinimum":        0,
	})
}

// HandleScore submits score
func (h *AGSHandler) HandleScore(c fiber.Ctx) error {
	if h.cfg.IsMockMode() {
		return c.JSON(fiber.Map{
			"status":  "success",
			"message": "Mock score submitted",
		})
	}

	return c.JSON(fiber.Map{
		"status":  "success",
	})
}

// HandleGetScores gets scores
func (h *AGSHandler) HandleGetScores(c fiber.Ctx) error {
	lineItemID := c.Params("lineItemId")

	if h.cfg.IsMockMode() {
		return c.JSON(fiber.Map{
			"lineItem": lineItemID,
			"scores": []fiber.Map{},
		})
	}

	return c.JSON(fiber.Map{"scores": []fiber.Map{}})
}