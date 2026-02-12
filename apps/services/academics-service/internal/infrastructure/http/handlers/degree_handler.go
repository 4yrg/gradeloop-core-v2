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

type DegreeHandler struct {
	service *usecases.DegreeService
}

func NewDegreeHandler(service *usecases.DegreeService) *DegreeHandler {
	return &DegreeHandler{service: service}
}

// HandleError centralizes error handling for the handler.
func (h *DegreeHandler) HandleError(c fiber.Ctx, err error) error {
	var appErr *utils.AppError
	if errors.As(err, &appErr) {
		return c.Status(appErr.Code).JSON(fiber.Map{"error": appErr.Message})
	}
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
}

// CreateDegree handles POST /departments/{department_id}/degrees
func (h *DegreeHandler) CreateDegree(c fiber.Ctx) error {
	departmentID, err := uuid.Parse(c.Params("department_id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid department ID"})
	}

	var req dto.CreateDegreeRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	// Note: In a production app, use a validation library here.

	degree, err := h.service.CreateDegree(c.Context(), departmentID, req)
	if err != nil {
		return h.HandleError(c, err)
	}

	return c.Status(fiber.StatusCreated).JSON(dto.ToDegreeResponse(degree))
}

// ListDegrees handles GET /departments/{department_id}/degrees
func (h *DegreeHandler) ListDegrees(c fiber.Ctx) error {
	departmentID, err := uuid.Parse(c.Params("department_id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid department ID"})
	}
	includeInactive, _ := strconv.ParseBool(c.Query("include_inactive", "false"))

	degrees, err := h.service.ListDegreesByDepartment(c.Context(), departmentID, includeInactive)
	if err != nil {
		return h.HandleError(c, err)
	}

	return c.Status(fiber.StatusOK).JSON(dto.ToDegreeListResponse(degrees))
}

// GetDegree handles GET /degrees/{id}
func (h *DegreeHandler) GetDegree(c fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid degree ID"})
	}
	includeInactive, _ := strconv.ParseBool(c.Query("include_inactive", "false"))

	degree, err := h.service.GetDegree(c.Context(), id, includeInactive)
	if err != nil {
		return h.HandleError(c, err)
	}

	return c.Status(fiber.StatusOK).JSON(dto.ToDegreeResponse(degree))
}

// UpdateDegree handles PATCH /degrees/{id}
func (h *DegreeHandler) UpdateDegree(c fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid degree ID"})
	}

	var req dto.UpdateDegreeRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	degree, err := h.service.UpdateDegree(c.Context(), id, req)
	if err != nil {
		return h.HandleError(c, err)
	}

	return c.Status(fiber.StatusOK).JSON(dto.ToDegreeResponse(degree))
}

// DeleteDegree handles DELETE /degrees/{id}
func (h *DegreeHandler) DeleteDegree(c fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid degree ID"})
	}

	err = h.service.DeleteDegree(c.Context(), id)
	if err != nil {
		return h.HandleError(c, err)
	}

	return c.SendStatus(fiber.StatusNoContent)
}
