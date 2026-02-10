package handlers

import (
	"strings"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/application/usecases"
	"github.com/gofiber/fiber/v3"
)

type PermissionHandler struct {
	usecase *usecases.PermissionUsecase
}

func NewPermissionHandler(uc *usecases.PermissionUsecase) *PermissionHandler {
	return &PermissionHandler{usecase: uc}
}

// ListPermissions handles GET /permissions
func (h *PermissionHandler) ListPermissions(ctx fiber.Ctx) error {
	permissions, err := h.usecase.ListPermissions(ctx.Context())
	if err != nil {
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.Status(fiber.StatusOK).JSON(permissions)
}

// GetPermissionByName handles GET /permissions/{name}
func (h *PermissionHandler) GetPermissionByName(ctx fiber.Ctx) error {
	name := ctx.Params("name")
	if name == "" {
		return ctx.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Permission name is required"})
	}

	permission, err := h.usecase.GetPermissionByName(ctx.Context(), name)
	if err != nil {
		if strings.Contains(err.Error(), "record not found") {
			return ctx.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Permission not found"})
		}
		return ctx.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return ctx.Status(fiber.StatusOK).JSON(permission)
}
