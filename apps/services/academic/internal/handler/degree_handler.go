package handler

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academic/internal/domain"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academic/internal/dto"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academic/internal/service"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academic/internal/utils"
	"go.uber.org/zap"
)

// DegreeHandler handles degree-related HTTP requests
type DegreeHandler struct {
	degreeService service.DegreeService
	logger        *zap.Logger
}

// NewDegreeHandler creates a new degree handler
func NewDegreeHandler(degreeService service.DegreeService, logger *zap.Logger) *DegreeHandler {
	return &DegreeHandler{
		degreeService: degreeService,
		logger:        logger,
	}
}

// CreateDegree handles POST /degrees
func (h *DegreeHandler) CreateDegree(c fiber.Ctx) error {
	var req dto.CreateDegreeRequest
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

	degree, err := h.degreeService.CreateDegree(&req, 0, username, ipAddress, userAgent)
	if err != nil {
		return err
	}

	return c.Status(fiber.StatusCreated).JSON(h.toDegreeResponse(degree))
}

// UpdateDegree handles PUT /degrees/:id
func (h *DegreeHandler) UpdateDegree(c fiber.Ctx) error {
	idParam := c.Params("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		return utils.ErrBadRequest("invalid degree id")
	}

	var req dto.UpdateDegreeRequest
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

	degree, err := h.degreeService.UpdateDegree(id, &req, 0, username, ipAddress, userAgent)
	if err != nil {
		return err
	}

	return c.Status(fiber.StatusOK).JSON(h.toDegreeResponse(degree))
}

// DeactivateDegree handles PATCH /degrees/:id/deactivate
func (h *DegreeHandler) DeactivateDegree(c fiber.Ctx) error {
	idParam := c.Params("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		return utils.ErrBadRequest("invalid degree id")
	}

	var req dto.DeactivateDegreeRequest
	if err := c.Bind().JSON(&req); err != nil {
		return utils.ErrBadRequest("invalid request body")
	}
	// Expect { "is_active": false }
	if req.IsActive {
		return utils.ErrBadRequest("is_active must be false to deactivate")
	}

	// Get user info from context (username from IAM JWT)
	username, ok := c.Locals("username").(string)
	if !ok || username == "" {
		return utils.ErrUnauthorized("user not authenticated")
	}

	ipAddress := c.IP()
	userAgent := c.Get("User-Agent")

	if err := h.degreeService.DeactivateDegree(id, 0, username, ipAddress, userAgent); err != nil {
		return err
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "degree deactivated successfully",
	})
}

// GetDegree handles GET /degrees/:id
func (h *DegreeHandler) GetDegree(c fiber.Ctx) error {
	idParam := c.Params("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		return utils.ErrBadRequest("invalid degree id")
	}

	degree, err := h.degreeService.GetDegreeByID(id)
	if err != nil {
		return err
	}

	return c.Status(fiber.StatusOK).JSON(h.toDegreeResponse(degree))
}

// ListDegrees handles GET /degrees
func (h *DegreeHandler) ListDegrees(c fiber.Ctx) error {
	var query dto.ListDegreesQuery
	if err := c.Bind().Query(&query); err != nil {
		return utils.ErrBadRequest("invalid query params")
	}

	degrees, err := h.degreeService.ListDegrees(query.IncludeInactive)
	if err != nil {
		return err
	}

	responses := make([]dto.DegreeResponse, len(degrees))
	for i := range degrees {
		responses[i] = *h.toDegreeResponse(&degrees[i])
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"degrees": responses,
		"count":   len(responses),
	})
}

// ListDegreesByDepartment handles GET /departments/:id/degrees
func (h *DegreeHandler) ListDegreesByDepartment(c fiber.Ctx) error {
	idParam := c.Params("id")
	deptID, err := uuid.Parse(idParam)
	if err != nil {
		return utils.ErrBadRequest("invalid department id")
	}

	var query dto.ListDegreesQuery
	if err := c.Bind().Query(&query); err != nil {
		return utils.ErrBadRequest("invalid query params")
	}

	degrees, err := h.degreeService.ListDegreesByDepartment(deptID, query.IncludeInactive)
	if err != nil {
		return err
	}

	responses := make([]dto.DegreeResponse, len(degrees))
	for i := range degrees {
		responses[i] = *h.toDegreeResponse(&degrees[i])
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"degrees": responses,
		"count":   len(responses),
	})
}

// toDegreeResponse converts domain.Degree to dto.DegreeResponse
func (h *DegreeHandler) toDegreeResponse(degree *domain.Degree) *dto.DegreeResponse {
	return &dto.DegreeResponse{
		ID:           degree.ID,
		DepartmentID: degree.DepartmentID,
		Name:         degree.Name,
		Code:         degree.Code,
		Level:        degree.Level,
		IsActive:     degree.IsActive,
		CreatedAt:    degree.CreatedAt,
		UpdatedAt:    degree.UpdatedAt,
	}
}
