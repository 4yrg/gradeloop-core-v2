package handlers

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/services"
)

// UserHandler handles user-related HTTP requests
type UserHandler struct {
	UserService *services.UserService
}

// NewUserHandler creates a new user handler instance
func NewUserHandler(userService *services.UserService) *UserHandler {
	return &UserHandler{
		UserService: userService,
	}
}

// CreateUser handles user creation requests
func (h *UserHandler) CreateUser(c fiber.Ctx) error {
	var req struct {
		Email    string `json:"email" validate:"required,email"`
		FullName string `json:"full_name" validate:"required"`
		Password string `json:"password" validate:"required,min=12"`
		UserType string `json:"user_type" validate:"required,oneof=student instructor admin"`
	}

	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	user, err := h.UserService.CreateUser(req.Email, req.FullName, req.Password, req.UserType)
	if err != nil {
		log.Error().Err(err).Str("email", req.Email).Msg("Failed to create user")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to create user",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"id":                         user.ID,
		"email":                      user.Email,
		"full_name":                  user.FullName,
		"is_active":                  user.IsActive,
		"user_type":                  user.UserType,
		"is_password_reset_required": user.IsPasswordResetRequired,
		"created_at":                 user.CreatedAt,
		"updated_at":                 user.UpdatedAt,
	})
}

// GetUserByID handles user retrieval by ID
func (h *UserHandler) GetUserByID(c fiber.Ctx) error {
	userIDParam := c.Params("id")
	userID, err := uuid.Parse(userIDParam)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid user ID format",
		})
	}

	user, err := h.UserService.GetUserByID(userID)
	if err != nil {
		log.Error().Err(err).Str("user_id", userIDParam).Msg("Failed to get user")
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "User not found",
		})
	}

	return c.JSON(fiber.Map{
		"id":                         user.ID,
		"email":                      user.Email,
		"full_name":                  user.FullName,
		"is_active":                  user.IsActive,
		"user_type":                  user.UserType,
		"is_password_reset_required": user.IsPasswordResetRequired,
		"created_at":                 user.CreatedAt,
		"updated_at":                 user.UpdatedAt,
	})
}

// ListUsers handles listing users
func (h *UserHandler) ListUsers(c fiber.Ctx) error {
	includeDeletedParam := c.Query("include_deleted", "false")
	includeDeleted := includeDeletedParam == "true"

	users, err := h.UserService.ListUsers(includeDeleted)
	if err != nil {
		log.Error().Err(err).Msg("Failed to list users")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to list users",
		})
	}

	var response []fiber.Map
	for _, user := range users {
		response = append(response, fiber.Map{
			"id":                         user.ID,
			"email":                      user.Email,
			"full_name":                  user.FullName,
			"is_active":                  user.IsActive,
			"user_type":                  user.UserType,
			"is_password_reset_required": user.IsPasswordResetRequired,
			"created_at":                 user.CreatedAt,
			"updated_at":                 user.UpdatedAt,
		})
	}

	return c.JSON(fiber.Map{
		"users": response,
		"count": len(response),
	})
}

// UpdateUser handles user update requests
func (h *UserHandler) UpdateUser(c fiber.Ctx) error {
	userIDParam := c.Params("id")
	userID, err := uuid.Parse(userIDParam)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid user ID format",
		})
	}

	var req struct {
		FullName *string `json:"full_name"`
		IsActive *bool   `json:"is_active"`
	}

	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	user, err := h.UserService.UpdateUser(userID, req.FullName, req.IsActive)
	if err != nil {
		log.Error().Err(err).Str("user_id", userIDParam).Msg("Failed to update user")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to update user",
		})
	}

	return c.JSON(fiber.Map{
		"id":                         user.ID,
		"email":                      user.Email,
		"full_name":                  user.FullName,
		"is_active":                  user.IsActive,
		"user_type":                  user.UserType,
		"is_password_reset_required": user.IsPasswordResetRequired,
		"created_at":                 user.CreatedAt,
		"updated_at":                 user.UpdatedAt,
	})
}

// DeleteUser handles user soft deletion requests
func (h *UserHandler) DeleteUser(c fiber.Ctx) error {
	userIDParam := c.Params("id")
	userID, err := uuid.Parse(userIDParam)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid user ID format",
		})
	}

	err = h.UserService.SoftDeleteUser(userID)
	if err != nil {
		log.Error().Err(err).Str("user_id", userIDParam).Msg("Failed to delete user")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to delete user",
		})
	}

	return c.JSON(fiber.Map{
		"message": "User deleted successfully",
	})
}

// RestoreUser handles user restoration requests
func (h *UserHandler) RestoreUser(c fiber.Ctx) error {
	userIDParam := c.Params("id")
	userID, err := uuid.Parse(userIDParam)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid user ID format",
		})
	}

	err = h.UserService.RestoreUser(userID)
	if err != nil {
		log.Error().Err(err).Str("user_id", userIDParam).Msg("Failed to restore user")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to restore user",
		})
	}

	return c.JSON(fiber.Map{
		"message": "User restored successfully",
	})
}
