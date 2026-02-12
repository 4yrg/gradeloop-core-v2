package handlers

import (
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/dto"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/usecases"
	"github.com/gofiber/fiber/v3"
)

type AcademicStructureHandler struct {
	service *usecases.AcademicStructureService
}

func NewAcademicStructureHandler(service *usecases.AcademicStructureService) *AcademicStructureHandler {
	return &AcademicStructureHandler{service: service}
}

func (h *AcademicStructureHandler) CreateCourse(c fiber.Ctx) error {
	var req dto.CreateCourseRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	course, err := h.service.CreateCourse(c.Context(), req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(course)
}

func (h *AcademicStructureHandler) ListCourses(c fiber.Ctx) error {
	courses, err := h.service.ListCourses(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(courses)
}

func (h *AcademicStructureHandler) CreateSemester(c fiber.Ctx) error {
	var req dto.CreateSemesterRequest
	if err := c.Bind().JSON(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	semester, err := h.service.CreateSemester(c.Context(), req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(semester)
}

func (h *AcademicStructureHandler) ListSemesters(c fiber.Ctx) error {
	includeInactive := c.Query("include_inactive") == "true"
	semesters, err := h.service.ListSemesters(c.Context(), includeInactive)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(semesters)
}
