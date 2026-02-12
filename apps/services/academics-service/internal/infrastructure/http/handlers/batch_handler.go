package handlers

import (
	"errors"
	"strconv"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/dto"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/usecases"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/utils"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

// BatchHandler handles HTTP requests for batch management.
type BatchHandler struct {
	service *usecases.BatchService
}

// NewBatchHandler creates a new BatchHandler.
func NewBatchHandler(service *usecases.BatchService) *BatchHandler {
	return &BatchHandler{service: service}
}

// HandleError centralizes error handling for the handler.
func (h *BatchHandler) HandleError(c fiber.Ctx, err error) error {
	var appErr *utils.AppError
	if errors.As(err, &appErr) {
		return c.Status(appErr.Code).JSON(fiber.Map{"error": appErr.Message})
	}
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
}

// CreateBatch handles POST /batches
func (h *BatchHandler) CreateBatch(c fiber.Ctx) error {
	var req dto.CreateBatchRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	// Note: In production, use a validation library here (e.g., go-playground/validator)

	batch, err := h.service.CreateBatch(c.Context(), req)
	if err != nil {
		return h.HandleError(c, err)
	}

	return c.Status(fiber.StatusCreated).JSON(dto.ToBatchResponse(batch))
}

// GetBatch handles GET /batches/:id
func (h *BatchHandler) GetBatch(c fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid batch ID"})
	}
	includeInactive, _ := strconv.ParseBool(c.Query("include_inactive", "false"))

	batch, err := h.service.GetBatch(c.Context(), id, includeInactive)
	if err != nil {
		return h.HandleError(c, err)
	}

	return c.Status(fiber.StatusOK).JSON(dto.ToBatchResponse(batch))
}

// GetDirectChildren handles GET /batches/:id/children
func (h *BatchHandler) GetDirectChildren(c fiber.Ctx) error {
	parentID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid parent batch ID"})
	}
	includeInactive, _ := strconv.ParseBool(c.Query("include_inactive", "false"))

	children, err := h.service.GetDirectChildren(c.Context(), parentID, includeInactive)
	if err != nil {
		return h.HandleError(c, err)
	}

	return c.Status(fiber.StatusOK).JSON(dto.ToBatchListResponse(children))
}

// GetSubtree handles GET /batches/tree/:root_id
func (h *BatchHandler) GetSubtree(c fiber.Ctx) error {
	rootID, err := uuid.Parse(c.Params("root_id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid root batch ID"})
	}
	includeInactive, _ := strconv.ParseBool(c.Query("include_inactive", "false"))

	batches, err := h.service.GetSubtree(c.Context(), rootID, includeInactive)
	if err != nil {
		return h.HandleError(c, err)
	}

	// Build tree structure from flat list
	tree := dto.BuildBatchTree(batches, rootID)
	if tree == nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "batch tree not found"})
	}

	return c.Status(fiber.StatusOK).JSON(tree)
}

// UpdateBatch handles PATCH /batches/:id
func (h *BatchHandler) UpdateBatch(c fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid batch ID"})
	}

	var req dto.UpdateBatchRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	batch, err := h.service.UpdateBatch(c.Context(), id, req)
	if err != nil {
		return h.HandleError(c, err)
	}

	return c.Status(fiber.StatusOK).JSON(dto.ToBatchResponse(batch))
}

// DeleteBatch handles DELETE /batches/:id
func (h *BatchHandler) DeleteBatch(c fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid batch ID"})
	}

	err = h.service.DeleteBatch(c.Context(), id)
	if err != nil {
		return h.HandleError(c, err)
	}

	return c.SendStatus(fiber.StatusNoContent)
}
