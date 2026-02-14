package handlers

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/services"
)

// RoleHandler handles role-related HTTP requests
type RoleHandler struct {
	RoleService *services.RoleService
}

// NewRoleHandler creates a new role handler instance
func NewRoleHandler(roleService *services.RoleService) *RoleHandler {
	return &RoleHandler{
		RoleService: roleService,
	}
}

// CreateRole handles role creation requests
func (h *RoleHandler) CreateRole(c fiber.Ctx) error {
	var req struct {
		Name          string      `json:"name" validate:"required"`
		Description   string      `json:"description"`
		PermissionIDs []uuid.UUID `json:"permission_ids"`
		IsCustom      bool        `json:"is_custom"`
	}

	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	role, err := h.RoleService.CreateRole(req.Name, req.Description, req.PermissionIDs, req.IsCustom)
	if err != nil {
		log.Error().Err(err).Str("role_name", req.Name).Msg("Failed to create role")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to create role",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"id":          role.ID,
		"name":        role.Name,
		"description": role.Description,
		"is_custom":   role.IsCustom,
		"permissions": role.Permissions,
		"created_at":  role.CreatedAt,
		"updated_at":  role.UpdatedAt,
	})
}

// GetRoleByID handles role retrieval by ID
func (h *RoleHandler) GetRoleByID(c fiber.Ctx) error {
	roleIDParam := c.Params("id")
	roleID, err := uuid.Parse(roleIDParam)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid role ID format",
		})
	}

	role, err := h.RoleService.GetRoleByID(roleID)
	if err != nil {
		log.Error().Err(err).Str("role_id", roleIDParam).Msg("Failed to get role")
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "Role not found",
		})
	}

	return c.JSON(fiber.Map{
		"id":          role.ID,
		"name":        role.Name,
		"description": role.Description,
		"is_custom":   role.IsCustom,
		"permissions": role.Permissions,
		"created_at":  role.CreatedAt,
		"updated_at":  role.UpdatedAt,
	})
}

// ListRoles handles listing roles
func (h *RoleHandler) ListRoles(c fiber.Ctx) error {
	roles, err := h.RoleService.ListRoles()
	if err != nil {
		log.Error().Err(err).Msg("Failed to list roles")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to list roles",
		})
	}

	var response []fiber.Map
	for _, role := range roles {
		response = append(response, fiber.Map{
			"id":          role.ID,
			"name":        role.Name,
			"description": role.Description,
			"is_custom":   role.IsCustom,
			"permissions": role.Permissions,
			"created_at":  role.CreatedAt,
			"updated_at":  role.UpdatedAt,
		})
	}

	return c.JSON(fiber.Map{
		"roles": response,
		"count": len(response),
	})
}

// AddPermissionToRole handles adding a permission to a role
func (h *RoleHandler) AddPermissionToRole(c fiber.Ctx) error {
	roleIDParam := c.Params("roleId")
	roleID, err := uuid.Parse(roleIDParam)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid role ID format",
		})
	}

	permissionIDParam := c.Params("permissionId")
	permissionID, err := uuid.Parse(permissionIDParam)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid permission ID format",
		})
	}

	err = h.RoleService.AddPermissionToRole(roleID, permissionID)
	if err != nil {
		log.Error().Err(err).Str("role_id", roleIDParam).Str("permission_id", permissionIDParam).Msg("Failed to add permission to role")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to add permission to role",
		})
	}

	return c.JSON(fiber.Map{
		"message": "Permission added to role successfully",
	})
}

// RemovePermissionFromRole handles removing a permission from a role
func (h *RoleHandler) RemovePermissionFromRole(c fiber.Ctx) error {
	roleIDParam := c.Params("roleId")
	roleID, err := uuid.Parse(roleIDParam)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid role ID format",
		})
	}

	permissionIDParam := c.Params("permissionId")
	permissionID, err := uuid.Parse(permissionIDParam)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid permission ID format",
		})
	}

	err = h.RoleService.RemovePermissionFromRole(roleID, permissionID)
	if err != nil {
		log.Error().Err(err).Str("role_id", roleIDParam).Str("permission_id", permissionIDParam).Msg("Failed to remove permission from role")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to remove permission from role",
		})
	}

	return c.JSON(fiber.Map{
		"message": "Permission removed from role successfully",
	})
}
