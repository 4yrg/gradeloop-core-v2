package handler

import (
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/service"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

type RBACHandler struct {
	rbacService service.RBACService
}

func NewRBACHandler(rbacService service.RBACService) *RBACHandler {
	return &RBACHandler{rbacService: rbacService}
}

func (h *RBACHandler) GetRoles(c fiber.Ctx) error {
	tenantIDStr := c.Query("tenant_id", "")
	var tenantID uuid.UUID
	if tenantIDStr != "" {
		var err error
		tenantID, err = uuid.Parse(tenantIDStr)
		if err != nil {
			return fiber.ErrBadRequest
		}
	} else {
		// Use default tenant for now
		tenantID = uuid.MustParse("00000000-0000-0000-0000-000000000001")
	}

	roles, err := h.rbacService.ListRoles(c.RequestCtx(), tenantID)
	if err != nil {
		return handleServiceError(err)
	}

	return c.JSON(fiber.Map{
		"data":  roles,
		"total": len(roles),
	})
}

func (h *RBACHandler) GetPermissions(c fiber.Ctx) error {
	category := c.Query("category", "")

	permissions, err := h.rbacService.ListPermissions(c.RequestCtx(), category)
	if err != nil {
		return handleServiceError(err)
	}

	return c.JSON(fiber.Map{
		"data":  permissions,
		"total": len(permissions),
	})
}

func (h *RBACHandler) CreateRole(c fiber.Ctx) error {
	tenantIDStr := c.Query("tenant_id", "")
	var tenantID uuid.UUID
	if tenantIDStr != "" {
		var err error
		tenantID, err = uuid.Parse(tenantIDStr)
		if err != nil {
			return fiber.ErrBadRequest
		}
	} else {
		tenantID = uuid.MustParse("00000000-0000-0000-0000-000000000001")
	}

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}

	if err := c.Bind().Body(&req); err != nil {
		return fiber.ErrBadRequest
	}

	role, err := h.rbacService.CreateRole(c.RequestCtx(), tenantID, req.Name, req.Description)
	if err != nil {
		return handleServiceError(err)
	}

	return c.Status(fiber.StatusCreated).JSON(role)
}

func (h *RBACHandler) UpdateRole(c fiber.Ctx) error {
	roleID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}

	if err := c.Bind().Body(&req); err != nil {
		return fiber.ErrBadRequest
	}

	role, err := h.rbacService.UpdateRole(c.RequestCtx(), roleID, req.Name, req.Description)
	if err != nil {
		return handleServiceError(err)
	}

	return c.JSON(role)
}

func (h *RBACHandler) DeleteRole(c fiber.Ctx) error {
	roleID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	if err := h.rbacService.DeleteRole(c.RequestCtx(), roleID); err != nil {
		return handleServiceError(err)
	}

	return c.SendStatus(fiber.StatusNoContent)
}

func (h *RBACHandler) AssignRole(c fiber.Ctx) error {
	userIDStr := c.Params("id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return fiber.ErrBadRequest
	}

	var req struct {
		RoleID   string `json:"role_id"`
		TenantID string `json:"tenant_id"`
	}

	if err := c.Bind().Body(&req); err != nil {
		return fiber.ErrBadRequest
	}

	roleID, err := uuid.Parse(req.RoleID)
	if err != nil {
		return fiber.ErrBadRequest
	}

	var tenantID uuid.UUID
	if req.TenantID != "" {
		tenantID, err = uuid.Parse(req.TenantID)
		if err != nil {
			return fiber.ErrBadRequest
		}
	} else {
		tenantID = uuid.MustParse("00000000-0000-0000-0000-000000000001")
	}

	// Get current user from context (set by auth middleware)
	currentUserID, ok := c.Locals("user_id").(string)
	if !ok {
		return fiber.ErrUnauthorized
	}

	currentUserUUID, err := uuid.Parse(currentUserID)
	if err != nil {
		return fiber.ErrUnauthorized
	}

	if err := h.rbacService.AssignRole(c.RequestCtx(), userID, roleID, tenantID, currentUserUUID); err != nil {
		return handleServiceError(err)
	}

	return c.JSON(fiber.Map{"message": "role assigned"})
}

// Helper function to handle service errors

func handleServiceError(err error) error {
	switch err {
	case service.ErrRoleNotFound:
		return fiber.NewError(fiber.StatusNotFound, "Role not found")
	case service.ErrRoleExists:
		return fiber.NewError(fiber.StatusConflict, "Role already exists")
	case service.ErrPermissionNotFound:
		return fiber.NewError(fiber.StatusNotFound, "Permission not found")
	default:
		return err
	}
}
