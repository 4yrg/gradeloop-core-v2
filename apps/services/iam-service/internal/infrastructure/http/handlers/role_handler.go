package handlers

import (
	"strings"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/application/usecases"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

type UpdateRolePermissionsRequest struct {
	PermissionIDs []uuid.UUID `json:"permission_ids"`
}

type RoleHandler struct {
	usecase *usecases.RoleUsecase
}

func NewRoleHandler(uc *usecases.RoleUsecase) *RoleHandler {
	return &RoleHandler{usecase: uc}
}

// CreateRole handles POST /roles
func (h *RoleHandler) CreateRole(ctx *fiber.Ctx) error {
	var role models.Role
	if err := ctx.BodyParser(&role); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	createdRole, err := h.usecase.CreateRole(ctx.Context(), &role)
	if err != nil {
		if strings.Contains(err.Error(), "already exists") {
			return ctx.Status(fiber.StatusConflict).JSON(fiber.Map{"error": err.Error()})
		}
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.Status(fiber.StatusCreated).JSON(createdRole)
}

// ListRoles handles GET /roles
func (h *RoleHandler) ListRoles(ctx *fiber.Ctx) error {
	roles, err := h.usecase.ListRoles(ctx.Context())
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.Status(fiber.StatusOK).JSON(roles)
}

// UpdatePermissions handles PATCH /roles/{id}/permissions
func (h *RoleHandler) UpdatePermissions(ctx *fiber.Ctx) error {
	idParam := ctx.Params("id")
	roleID, err := uuid.Parse(idParam)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid Role ID format"})
	}

	var req UpdateRolePermissionsRequest
	if err := ctx.BodyParser(&req); err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	err = h.usecase.UpdateRolePermissions(ctx.Context(), roleID, req.PermissionIDs)
	if err != nil {
		if strings.Contains(err.Error(), "not exist") {
			return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		}
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.Status(fiber.StatusOK).JSON(fiber.Map{"message": "Permissions updated successfully"})
}

// DeleteRole handles DELETE /roles/{id}
func (h *RoleHandler) DeleteRole(ctx *fiber.Ctx) error {
	idParam := ctx.Params("id")
	id, err := uuid.Parse(idParam)
	if err != nil {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID format"})
	}

	if err := h.usecase.DeleteRole(ctx.Context(), id); err != nil {
		if strings.Contains(err.Error(), "cannot be deleted") {
			return ctx.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
		}
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.SendStatus(fiber.StatusNoContent)
}
