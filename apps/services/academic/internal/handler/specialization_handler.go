package handler

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"github.com/gradeloop/academic-service/internal/domain"
	"github.com/gradeloop/academic-service/internal/dto"
	"github.com/gradeloop/academic-service/internal/service"
	"github.com/gradeloop/academic-service/internal/utils"
	"go.uber.org/zap"
)

// SpecializationHandler handles specialization-related HTTP requests
type SpecializationHandler struct {
	specializationService service.SpecializationService
	logger                *zap.Logger
}

// NewSpecializationHandler creates a new specialization handler
func NewSpecializationHandler(specializationService service.SpecializationService, logger *zap.Logger) *SpecializationHandler {
	return &SpecializationHandler{
		specializationService: specializationService,
		logger:                logger,
	}
}

// CreateSpecialization handles POST /specializations
func (h *SpecializationHandler) CreateSpecialization(c fiber.Ctx) error {
	var req dto.CreateSpecializationRequest
	if err := c.Bind().JSON(&req); err != nil {
		return utils.ErrBadRequest("invalid request body")
	}

	// Get user info from context (username from IAM JWT)
	username, ok := c.Locals("username").(string)
	if !ok || username == "" {
		return utils.ErrUnauthorized("user not authenticated")
	}

	ipAddress := c.IP()
	userAgent := c.Get("User-Agent")

	spec, err := h.specializationService.CreateSpecialization(&req, 0, username, ipAddress, userAgent)
	if err != nil {
		return err
	}

	response := h.toSpecializationResponse(spec)
	return c.Status(fiber.StatusCreated).JSON(response)
}

// UpdateSpecialization handles PUT /specializations/:id
func (h *SpecializationHandler) UpdateSpecialization(c fiber.Ctx) error {
	idParam := c.Params("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		return utils.ErrBadRequest("invalid specialization id")
	}

	var req dto.UpdateSpecializationRequest
	if err := c.Bind().JSON(&req); err != nil {
		return utils.ErrBadRequest("invalid request body")
	}

	// Get user info from context
	username, ok := c.Locals("username").(string)
	if !ok || username == "" {
		return utils.ErrUnauthorized("user not authenticated")
	}

	ipAddress := c.IP()
	userAgent := c.Get("User-Agent")

	spec, err := h.specializationService.UpdateSpecialization(id, &req, 0, username, ipAddress, userAgent)
	if err != nil {
		return err
	}

	response := h.toSpecializationResponse(spec)
	return c.Status(fiber.StatusOK).JSON(response)
}

// DeactivateSpecialization handles PATCH /specializations/:id/deactivate
func (h *SpecializationHandler) DeactivateSpecialization(c fiber.Ctx) error {
	idParam := c.Params("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		return utils.ErrBadRequest("invalid specialization id")
	}

	// Bind body (expect { "is_active": false })
	var req dto.DeactivateSpecializationRequest
	if err := c.Bind().JSON(&req); err != nil {
		return utils.ErrBadRequest("invalid request body")
	}

	// Get user info from context
	username, ok := c.Locals("username").(string)
	if !ok || username == "" {
		return utils.ErrUnauthorized("user not authenticated")
	}

	ipAddress := c.IP()
	userAgent := c.Get("User-Agent")

	if err := h.specializationService.DeactivateSpecialization(id, req.IsActive, 0, username, ipAddress, userAgent); err != nil {
		return err
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "specialization updated successfully",
	})
}

// GetSpecialization handles GET /specializations/:id
func (h *SpecializationHandler) GetSpecialization(c fiber.Ctx) error {
	idParam := c.Params("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		return utils.ErrBadRequest("invalid specialization id")
	}

	spec, err := h.specializationService.GetSpecializationByID(id)
	if err != nil {
		return err
	}

	response := h.toSpecializationResponse(spec)
	return c.Status(fiber.StatusOK).JSON(response)
}

// ListSpecializationsByDegree handles GET /degrees/:id/specializations
func (h *SpecializationHandler) ListSpecializationsByDegree(c fiber.Ctx) error {
	idParam := c.Params("id")
	degreeID, err := uuid.Parse(idParam)
	if err != nil {
		return utils.ErrBadRequest("invalid degree id")
	}

	var query dto.ListSpecializationsQuery
	if err := c.Bind().Query(&query); err != nil {
		return utils.ErrBadRequest("invalid query parameters")
	}

	specs, err := h.specializationService.ListSpecializationsByDegree(degreeID, query.IncludeInactive)
	if err != nil {
		return err
	}

	responses := make([]dto.SpecializationResponse, len(specs))
	for i, s := range specs {
		responses[i] = *h.toSpecializationResponse(&s)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"specializations": responses,
		"count":           len(responses),
	})
}

// toSpecializationResponse converts domain.Specialization to dto.SpecializationResponse
func (h *SpecializationHandler) toSpecializationResponse(spec *domain.Specialization) *dto.SpecializationResponse {
	return &dto.SpecializationResponse{
		ID:        spec.ID,
		DegreeID:  spec.DegreeID,
		Name:      spec.Name,
		Code:      spec.Code,
		IsActive:  spec.IsActive,
		CreatedAt: spec.CreatedAt,
		UpdatedAt: spec.UpdatedAt,
	}
}
