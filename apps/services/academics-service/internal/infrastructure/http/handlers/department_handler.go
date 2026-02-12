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

type DepartmentHandler struct {
	service *usecases.DepartmentService
}

func NewDepartmentHandler(service *usecases.DepartmentService) *DepartmentHandler {
	return &DepartmentHandler{service: service}
}

// HandleError centralizes error handling for the handler.
func (h *DepartmentHandler) HandleError(c fiber.Ctx, err error) error {
	var appErr *utils.AppError
	if errors.As(err, &appErr) {
		return c.Status(appErr.Code).JSON(fiber.Map{"error": appErr.Message})
	}
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
}

// CreateDepartment handles POST /faculties/{faculty_id}/departments
func (h *DepartmentHandler) CreateDepartment(c fiber.Ctx) error {
	facultyID, err := uuid.Parse(c.Params("faculty_id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid faculty ID"})
	}

	var req dto.CreateDepartmentRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	// Note: In a production app, use a validation library here.

	dept, err := h.service.CreateDepartment(c.Context(), facultyID, req)
	if err != nil {
		return h.HandleError(c, err)
	}

	return c.Status(fiber.StatusCreated).JSON(dto.ToDepartmentResponse(dept))
}

// ListDepartments handles GET /faculties/{faculty_id}/departments
func (h *DepartmentHandler) ListDepartments(c fiber.Ctx) error {
	facultyID, err := uuid.Parse(c.Params("faculty_id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid faculty ID"})
	}
	includeInactive, _ := strconv.ParseBool(c.Query("include_inactive", "false"))

	depts, err := h.service.ListDepartmentsByFaculty(c.Context(), facultyID, includeInactive)
	if err != nil {
		return h.HandleError(c, err)
	}

	return c.Status(fiber.StatusOK).JSON(dto.ToDepartmentListResponse(depts))
}

// GetDepartment handles GET /departments/{id}
func (h *DepartmentHandler) GetDepartment(c fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid department ID"})
	}
	includeInactive, _ := strconv.ParseBool(c.Query("include_inactive", "false"))

	dept, err := h.service.GetDepartment(c.Context(), id, includeInactive)
	if err != nil {
		return h.HandleError(c, err)
	}

	return c.Status(fiber.StatusOK).JSON(dto.ToDepartmentResponse(dept))
}

// UpdateDepartment handles PATCH /departments/{id}
func (h *DepartmentHandler) UpdateDepartment(c fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid department ID"})
	}

	var req dto.UpdateDepartmentRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	dept, err := h.service.UpdateDepartment(c.Context(), id, req)
	if err != nil {
		return h.HandleError(c, err)
	}

	return c.Status(fiber.StatusOK).JSON(dto.ToDepartmentResponse(dept))
}

// DeleteDepartment handles DELETE /departments/{id}
func (h *DepartmentHandler) DeleteDepartment(c fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid department ID"})
	}

	err = h.service.DeleteDepartment(c.Context(), id)
	if err != nil {
		return h.HandleError(c, err)
	}

	return c.SendStatus(fiber.StatusNoContent)
}
