package handler

import (
	"context"
	"strings"

	"github.com/4yrg/gradeloop-core-v2/apps/services/cipas/cipas-xai/internal/dto"
	"github.com/4yrg/gradeloop-core-v2/apps/services/cipas/cipas-xai/internal/service"
	"github.com/gofiber/fiber/v3"
	"go.uber.org/zap"
)

// ReasonHandler handles reasoning HTTP requests
type ReasonHandler struct {
	reasonService *service.ReasonService
	logger        *zap.Logger
}

// NewReasonHandler creates a new reason handler
func NewReasonHandler(reasonService *service.ReasonService, logger *zap.Logger) *ReasonHandler {
	return &ReasonHandler{
		reasonService: reasonService,
		logger:        logger,
	}
}

// Reason handles reasoning requests
// @Summary Explain why a code snippet matches a clone/AI detection type
// @Description Provide reasoning for a specific detection type based on code snippets
// @Tags xai
// @Accept json
// @Produce json
// @Param request body dto.ReasonRequest true "Reasoning request"
// @Success 200 {object} dto.ReasonResponse
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /api/v1/cipas-xai/reason [post]
func (h *ReasonHandler) Reason(c fiber.Ctx) error {
	var req dto.ReasonRequest
	if err := c.Bind().JSON(&req); err != nil {
		h.logger.Warn("invalid reason request", zap.Error(err))
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// Validation
	req.Type = strings.ToUpper(req.Type)
	validTypes := map[string]bool{
		"TYPE-01": true,
		"TYPE-02": true,
		"TYPE-03": true,
		"TYPE-04": true,
		"TYPE-AI": true,
	}

	if !validTypes[req.Type] {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid type. Must be one of: TYPE-01, TYPE-02, TYPE-03, TYPE-04, TYPE-AI",
		})
	}

	if req.Type == "TYPE-AI" {
		if len(req.Code) != 1 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "TYPE-AI reasoning requires exactly one code snippet",
			})
		}
	} else {
		if len(req.Code) < 2 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "Clone detection reasoning (TYPE-01 to TYPE-04) requires at least two code snippets",
			})
		}
	}

	h.logger.Info("processing reasoning request",
		zap.String("type", req.Type),
		zap.Int("code_count", len(req.Code)),
	)

	resp, err := h.reasonService.GetReason(context.Background(), req)
	if err != nil {
		h.logger.Error("reasoning service error", zap.Error(err))
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to process reasoning request",
		})
	}

	return c.JSON(resp)
}
