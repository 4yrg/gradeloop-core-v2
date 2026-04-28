package lti

import (
	"encoding/json"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/config"
	"github.com/gofiber/fiber/v3"
)

// DeepLinkHandler handles LTI Deep Linking
type DeepLinkHandler struct {
	cfg *config.LTIConfig
}

// NewDeepLinkHandler creates deep linking handler
func NewDeepLinkHandler(cfg *config.LTIConfig) *DeepLinkHandler {
	return &DeepLinkHandler{cfg: cfg}
}

// HandleDeepLinkRequest handles deep link request
func (h *DeepLinkHandler) HandleDeepLinkRequest(c fiber.Ctx) error {
	returnURL := c.Query("return_url")

	if returnURL == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":             "invalid_request",
			"error_description": "Missing return_url",
		})
	}

	if h.cfg.IsMockMode() {
		return c.JSON(fiber.Map{
			"deep_link_setting_id": "mock-setting-1",
			"return_url":           returnURL,
			"content": []fiber.Map{
				{
					"type":  "ltiResourceLink",
					"title": "Week 1 Introduction",
					"url":   "http://localhost:8081/content/intro-week1",
				},
			},
		})
	}

	return c.JSON(fiber.Map{
		"return_url": returnURL,
	})
}

// HandleDeepLinkResponse handles deep link response
func (h *DeepLinkHandler) HandleDeepLinkResponse(c fiber.Ctx) error {
	var req struct {
		JWT string `json:"jwt"`
	}

	if err := json.Unmarshal(c.Body(), &req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":             "invalid_request",
			"error_description": "Invalid JSON",
		})
	}

	if h.cfg.IsMockMode() {
		return c.JSON(fiber.Map{
			"status":  "success",
			"message": "Mock deep link response",
		})
	}

	return c.JSON(fiber.Map{
		"status":  "success",
		"message": "Deep link processed",
	})
}
