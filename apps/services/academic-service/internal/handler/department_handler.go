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

// DepartmentHandler handles department-related HTTP requests
type DepartmentHandler struct {
	departmentService service.DepartmentService
	logger            *zap.Logger
}

// NewDepartmentHandler creates a new department handler
func NewDepartmentHandler(departmentService service.DepartmentService, logger *zap.Logger) *DepartmentHandler {
	return &DepartmentHandler{
		departmentService: departmentService,
		logger:            logger,
	}
}

// CreateDepartment handles POST /departments
func (h *DepartmentHandler) CreateDepartment(c fiber.Ctx) error {
	var req dto.CreateDepartmentRequest
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

	// Use 0 as placeholder user_id since we're using UUID-based auth
	department, err := h.departmentService.CreateDepartment(&req, 0, username, ipAddress, userAgent)
	if err != nil {
		return err
	}

	response := h.toDepartmentResponse(department)
	return c.Status(fiber.StatusCreated).JSON(response)
}

// UpdateDepartment handles PUT /departments/:id
func (h *DepartmentHandler) UpdateDepartment(c fiber.Ctx) error {
	idParam := c.Params("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		return utils.ErrBadRequest("invalid department id")
	}

	var req dto.UpdateDepartmentRequest
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

	// Use 0 as placeholder user_id since we're using UUID-based auth
	department, err := h.departmentService.UpdateDepartment(id, &req, 0, username, ipAddress, userAgent)
	if err != nil {
		return err
	}

	response := h.toDepartmentResponse(department)
	return c.Status(fiber.StatusOK).JSON(response)
}

// DeactivateDepartment handles PATCH /departments/:id/deactivate
func (h *DepartmentHandler) DeactivateDepartment(c fiber.Ctx) error {
	idParam := c.Params("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		return utils.ErrBadRequest("invalid department id")
	}

	// Get user info from context (username from IAM JWT)
	username, ok := c.Locals("username").(string)
	if !ok || username == "" {
		return utils.ErrUnauthorized("user not authenticated")
	}

	ipAddress := c.IP()
	userAgent := c.Get("User-Agent")

	// Use 0 as placeholder user_id since we're using UUID-based auth
	if err := h.departmentService.DeactivateDepartment(id, 0, username, ipAddress, userAgent); err != nil {
		return err
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "department deactivated successfully",
	})
}

// GetDepartment handles GET /departments/:id
func (h *DepartmentHandler) GetDepartment(c fiber.Ctx) error {
	idParam := c.Params("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		return utils.ErrBadRequest("invalid department id")
	}

	department, err := h.departmentService.GetDepartmentByID(id)
	if err != nil {
		return err
	}

	response := h.toDepartmentResponse(department)
	return c.Status(fiber.StatusOK).JSON(response)
}

// ListDepartments handles GET /departments
func (h *DepartmentHandler) ListDepartments(c fiber.Ctx) error {
	var query dto.ListDepartmentsQuery
	if err := c.Bind().Query(&query); err != nil {
		return utils.ErrBadRequest("invalid query parameters")
	}

	departments, err := h.departmentService.ListDepartments(query.IncludeInactive)
	if err != nil {
		return err
	}

	responses := make([]dto.DepartmentResponse, len(departments))
	for i, department := range departments {
		responses[i] = *h.toDepartmentResponse(&department)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"departments": responses,
		"count":       len(responses),
	})
}

// ListDepartmentsByFaculty handles GET /faculties/:id/departments
func (h *DepartmentHandler) ListDepartmentsByFaculty(c fiber.Ctx) error {
	idParam := c.Params("id")
	facultyID, err := uuid.Parse(idParam)
	if err != nil {
		return utils.ErrBadRequest("invalid faculty id")
	}

	var query dto.ListDepartmentsQuery
	if err := c.Bind().Query(&query); err != nil {
		return utils.ErrBadRequest("invalid query parameters")
	}

	departments, err := h.departmentService.ListDepartmentsByFaculty(facultyID, query.IncludeInactive)
	if err != nil {
		return err
	}

	responses := make([]dto.DepartmentResponse, len(departments))
	for i, department := range departments {
		responses[i] = *h.toDepartmentResponse(&department)
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"departments": responses,
		"count":       len(responses),
	})
}

// toDepartmentResponse converts domain.Department to dto.DepartmentResponse
func (h *DepartmentHandler) toDepartmentResponse(department *domain.Department) *dto.DepartmentResponse {
	return &dto.DepartmentResponse{
		ID:          department.ID,
		FacultyID:   department.FacultyID,
		Name:        department.Name,
		Code:        department.Code,
		Description: department.Description,
		IsActive:    department.IsActive,
		CreatedAt:   department.CreatedAt,
		UpdatedAt:   department.UpdatedAt,
	}
}
