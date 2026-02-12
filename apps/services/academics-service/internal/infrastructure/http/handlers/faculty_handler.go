package handlers

import (
	"strconv"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/dto"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/usecases"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

type FacultyHandler struct {
	service *usecases.FacultyService
}

func NewFacultyHandler(service *usecases.FacultyService) *FacultyHandler {
	return &FacultyHandler{service: service}
}

// CreateFaculty handles POST /faculties
func (h *FacultyHandler) CreateFaculty(c fiber.Ctx) error {
	var req dto.CreateFacultyRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	// Basic validation can be added here using a validator library

	faculty, err := h.service.CreateFaculty(c.Context(), req)
	if err != nil {
		// More specific error handling can be added here
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(dto.ToFacultyResponse(faculty))
}

// ListFaculties handles GET /faculties
func (h *FacultyHandler) ListFaculties(c fiber.Ctx) error {
	includeInactive, _ := strconv.ParseBool(c.Query("include_inactive", "false"))

	faculties, err := h.service.ListFaculties(c.Context(), includeInactive)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(dto.ToFacultyListResponse(faculties))
}

// GetFaculty handles GET /faculties/{id}
func (h *FacultyHandler) GetFaculty(c fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid faculty ID"})
	}
	includeInactive, _ := strconv.ParseBool(c.Query("include_inactive", "false"))

	faculty, err := h.service.GetFaculty(c.Context(), id, includeInactive)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "faculty not found"})
	}

	return c.Status(fiber.StatusOK).JSON(dto.ToFacultyResponse(faculty))
}

// UpdateFaculty handles PATCH /faculties/{id}
func (h *FacultyHandler) UpdateFaculty(c fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid faculty ID"})
	}

	var req dto.UpdateFacultyRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	faculty, err := h.service.UpdateFaculty(c.Context(), id, req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(dto.ToFacultyResponse(faculty))
}

// DeactivateFaculty handles DELETE /faculties/{id}
func (h *FacultyHandler) DeactivateFaculty(c fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid faculty ID"})
	}

	err = h.service.DeactivateFaculty(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

// GetFacultyLeaders handles GET /faculties/{id}/leaders
func (h *FacultyHandler) GetFacultyLeaders(c fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid faculty ID"})
	}

	leaders, err := h.service.GetFacultyLeaders(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(leaders)
}
