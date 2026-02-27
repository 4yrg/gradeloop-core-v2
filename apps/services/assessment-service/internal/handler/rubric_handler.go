package handler

import (
	"github.com/gofiber/fiber/v3"
	"github.com/4yrg/gradeloop-core-v2/assessment-service/internal/dto"
	"github.com/4yrg/gradeloop-core-v2/assessment-service/internal/service"
	"github.com/4yrg/gradeloop-core-v2/assessment-service/internal/utils"
	"go.uber.org/zap"
)

// RubricHandler handles rubric-related HTTP requests.
type RubricHandler struct {
	rubricService service.RubricService
	logger        *zap.Logger
}

// NewRubricHandler creates a new RubricHandler.
func NewRubricHandler(rubricService service.RubricService, logger *zap.Logger) *RubricHandler {
	return &RubricHandler{
		rubricService: rubricService,
		logger:        logger,
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /assignments/:id/rubric
// ─────────────────────────────────────────────────────────────────────────────

// CreateRubric handles POST /api/v1/assignments/:id/rubric.
// Creates a new rubric configuration for the specified assignment.
func (h *RubricHandler) CreateRubric(c fiber.Ctx) error {
	assignmentID, err := parseUUID(c, "id")
	if err != nil {
		return err
	}

	var req dto.CreateRubricRequest
	if err := c.Bind().JSON(&req); err != nil {
		return utils.ErrBadRequest("invalid request body")
	}

	username := requireUsername(c)
	if username == "" {
		return utils.ErrUnauthorized("user not authenticated")
	}

	if err := h.rubricService.CreateRubric(
		assignmentID,
		&req,
		username,
		c.IP(),
		c.Get("User-Agent"),
	); err != nil {
		return err
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message":     "rubric created successfully",
		"assignment_id": assignmentID.String(),
	})
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /assignments/:id/rubric
// ─────────────────────────────────────────────────────────────────────────────

// GetRubric handles GET /api/v1/assignments/:id/rubric.
// Returns the rubric configuration for the specified assignment.
func (h *RubricHandler) GetRubric(c fiber.Ctx) error {
	assignmentID, err := parseUUID(c, "id")
	if err != nil {
		return err
	}

	rubricConfig, version, err := h.rubricService.GetRubric(assignmentID)
	if err != nil {
		return err
	}

	// If no rubric configured, return default
	if rubricConfig == nil {
		defaultConfig := service.GetDefaultRubricConfig()
		return c.Status(fiber.StatusOK).JSON(dto.RubricResponse{
			AssignmentID: assignmentID,
			Execution:    defaultConfig.Execution,
			Dimensions:   defaultConfig.Dimensions,
			Version:      version,
			TotalWeight:  dto.TotalRubricWeight,
		})
	}

	// Convert domain to DTO
	dimensions := make([]dto.RubricDimensionDTO, len(rubricConfig.Dimensions))
	for i, dim := range rubricConfig.Dimensions {
		dimensions[i] = dto.RubricDimensionDTO{
			ID:          dim.ID,
			Name:        dim.Name,
			Weight:      dim.Weight,
			Description: dim.Description,
		}
	}

	totalWeight := rubricConfig.Execution.Weight
	for _, dim := range rubricConfig.Dimensions {
		totalWeight += dim.Weight
	}

	return c.Status(fiber.StatusOK).JSON(dto.RubricResponse{
		AssignmentID: assignmentID,
		Execution: dto.ExecutionConfigDTO{
			Weight:    rubricConfig.Execution.Weight,
			Fixed:     rubricConfig.Execution.Fixed,
			TestCases: rubricConfig.Execution.TestCases,
		},
		Dimensions:  dimensions,
		Version:     version,
		TotalWeight: totalWeight,
	})
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /assignments/:id/rubric
// ─────────────────────────────────────────────────────────────────────────────

// UpdateRubric handles PATCH /api/v1/assignments/:id/rubric.
// Updates the rubric configuration (creates a new version).
func (h *RubricHandler) UpdateRubric(c fiber.Ctx) error {
	assignmentID, err := parseUUID(c, "id")
	if err != nil {
		return err
	}

	var req dto.UpdateRubricRequest
	if err := c.Bind().JSON(&req); err != nil {
		return utils.ErrBadRequest("invalid request body")
	}

	username := requireUsername(c)
	if username == "" {
		return utils.ErrUnauthorized("user not authenticated")
	}

	if err := h.rubricService.UpdateRubric(
		assignmentID,
		&req,
		username,
		c.IP(),
		c.Get("User-Agent"),
	); err != nil {
		return err
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message":       "rubric updated successfully",
		"assignment_id": assignmentID.String(),
	})
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /evaluations/:id/override
// ─────────────────────────────────────────────────────────────────────────────

// ApplyInstructorOverride handles PATCH /api/v1/evaluations/:id/override.
// Allows instructors to manually adjust submission scores.
func (h *RubricHandler) ApplyInstructorOverride(c fiber.Ctx) error {
	submissionID, err := parseUUID(c, "id")
	if err != nil {
		return err
	}

	var req dto.InstructorOverrideRequest
	if err := c.Bind().JSON(&req); err != nil {
		return utils.ErrBadRequest("invalid request body")
	}

	username := requireUsername(c)
	if username == "" {
		return utils.ErrUnauthorized("user not authenticated")
	}

	if err := h.rubricService.ApplyInstructorOverride(submissionID, &req, username); err != nil {
		return err
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message":       "instructor override applied successfully",
		"submission_id": submissionID.String(),
	})
}
