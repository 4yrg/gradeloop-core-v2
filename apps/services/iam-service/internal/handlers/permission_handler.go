package handlers

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/services"
)

// PermissionHandler handles permission-related HTTP requests
type PermissionHandler struct {
	PermissionService *services.PermissionService
}

// NewPermissionHandler creates a new permission handler instance
func NewPermissionHandler(permissionService *services.PermissionService) *PermissionHandler {
	return &PermissionHandler{
		PermissionService: permissionService,
	}
}

// CreatePermission handles permission creation requests
func (h *PermissionHandler) CreatePermission(c fiber.Ctx) error {
	var req struct {
		Name        string `json:"name" validate:"required"`
		Description string `json:"description"`
	}

	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	permission, err := h.PermissionService.CreatePermission(req.Name, req.Description)
	if err != nil {
		log.Error().Err(err).Str("permission_name", req.Name).Msg("Failed to create permission")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to create permission",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"id":          permission.ID,
		"name":        permission.Name,
		"description": permission.Description,
		"created_at":  permission.CreatedAt,
		"updated_at":  permission.UpdatedAt,
	})
}

// GetPermissionByID handles permission retrieval by ID
func (h *PermissionHandler) GetPermissionByID(c fiber.Ctx) error {
	permissionIDParam := c.Params("id")
	permissionID, err := uuid.Parse(permissionIDParam)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid permission ID format",
		})
	}

	permission, err := h.PermissionService.GetPermissionByID(permissionID)
	if err != nil {
		log.Error().Err(err).Str("permission_id", permissionIDParam).Msg("Failed to get permission")
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Permission not found",
		})
	}

	return c.JSON(fiber.Map{
		"id":          permission.ID,
		"name":        permission.Name,
		"description": permission.Description,
		"created_at":  permission.CreatedAt,
		"updated_at":  permission.UpdatedAt,
	})
}

// ListPermissions handles listing permissions
func (h *PermissionHandler) ListPermissions(c fiber.Ctx) error {
	permissions, err := h.PermissionService.ListPermissions()
	if err != nil {
		log.Error().Err(err).Msg("Failed to list permissions")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to list permissions",
		})
	}

	var response []fiber.Map
	for _, permission := range permissions {
		response = append(response, fiber.Map{
			"id":          permission.ID,
			"name":        permission.Name,
			"description": permission.Description,
			"created_at":  permission.CreatedAt,
			"updated_at":  permission.UpdatedAt,
		})
	}

	return c.JSON(fiber.Map{
		"permissions": response,
		"count":       len(response),
	})
}
