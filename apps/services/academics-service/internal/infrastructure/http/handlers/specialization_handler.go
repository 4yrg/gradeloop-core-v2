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

type SpecializationHandler struct {
	service *usecases.SpecializationService
}

func NewSpecializationHandler(service *usecases.SpecializationService) *SpecializationHandler {
	return &SpecializationHandler{service: service}
}

// HandleError centralizes error handling for the handler.
func (h *SpecializationHandler) HandleError(c fiber.Ctx, err error) error {
	var appErr *utils.AppError
	if errors.As(err, &appErr) {
		return c.Status(appErr.Code).JSON(fiber.Map{"error": appErr.Message})
	}
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
}

// CreateSpecialization handles POST /degrees/{degree_id}/specializations
func (h *SpecializationHandler) CreateSpecialization(c fiber.Ctx) error {
	degreeID, err := uuid.Parse(c.Params("degree_id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid degree ID"})
	}

	var req dto.CreateSpecializationRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	// Note: In a production app, use a validation library here.

	specialization, err := h.service.CreateSpecialization(c.Context(), degreeID, req)
	if err != nil {
		return h.HandleError(c, err)
	}

	return c.Status(fiber.StatusCreated).JSON(dto.ToSpecializationResponse(specialization))
}

// ListSpecializations handles GET /degrees/{degree_id}/specializations
func (h *SpecializationHandler) ListSpecializations(c fiber.Ctx) error {
	degreeID, err := uuid.Parse(c.Params("degree_id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid degree ID"})
	}
	includeInactive, _ := strconv.ParseBool(c.Query("include_inactive", "false"))

	specializations, err := h.service.ListSpecializationsByDegree(c.Context(), degreeID, includeInactive)
	if err != nil {
		return h.HandleError(c, err)
	}

	return c.Status(fiber.StatusOK).JSON(dto.ToSpecializationListResponse(specializations))
}

// GetSpecialization handles GET /specializations/{id}
func (h *SpecializationHandler) GetSpecialization(c fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid specialization ID"})
	}
	includeInactive, _ := strconv.ParseBool(c.Query("include_inactive", "false"))

	specialization, err := h.service.GetSpecialization(c.Context(), id, includeInactive)
	if err != nil {
		return h.HandleError(c, err)
	}

	return c.Status(fiber.StatusOK).JSON(dto.ToSpecializationResponse(specialization))
}

// UpdateSpecialization handles PATCH /specializations/{id}
func (h *SpecializationHandler) UpdateSpecialization(c fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid specialization ID"})
	}

	var req dto.UpdateSpecializationRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	specialization, err := h.service.UpdateSpecialization(c.Context(), id, req)
	if err != nil {
		return h.HandleError(c, err)
	}

	return c.Status(fiber.StatusOK).JSON(dto.ToSpecializationResponse(specialization))
}

// DeleteSpecialization handles DELETE /specializations/{id}
func (h *SpecializationHandler) DeleteSpecialization(c fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid specialization ID"})
	}

	err = h.service.DeleteSpecialization(c.Context(), id)
	if err != nil {
		return h.HandleError(c, err)
	}

	return c.SendStatus(fiber.StatusNoContent)
}
