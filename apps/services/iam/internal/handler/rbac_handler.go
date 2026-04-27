package handler

import (
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/domain"
	"github.com/gofiber/fiber/v3"
)

type RBACHandler struct{}

func NewRBACHandler() *RBACHandler {
	return &RBACHandler{}
}

func (h *RBACHandler) GetRoles(c fiber.Ctx) error {
	roles := []fiber.Map{
		{"id": domain.UserTypeStudent, "name": "Student", "description": "Student role"},
		{"id": domain.UserTypeInstructor, "name": "Instructor", "description": "Instructor role"},
		{"id": domain.UserTypeAdmin, "name": "Admin", "description": "Administrator role"},
		{"id": domain.UserTypeSuperAdmin, "name": "Super Admin", "description": "Super Administrator role"},
	}

	return c.JSON(roles)
}

func (h *RBACHandler) GetPermissions(c fiber.Ctx) error {
	// Return empty list as we use hardcoded roles for now
	return c.JSON([]fiber.Map{})
}
