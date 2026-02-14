package handlers

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/services"
)

// AuthHandler handles authentication-related HTTP requests
type AuthHandler struct {
	AuthService *services.AuthService
	UserService *services.UserService
}

// NewAuthHandler creates a new authentication handler instance
func NewAuthHandler(authService *services.AuthService, userService *services.UserService) *AuthHandler {
	return &AuthHandler{
		AuthService: authService,
		UserService: userService,
	}
}

// Login handles user login requests
func (h *AuthHandler) Login(c fiber.Ctx) error {
	var req struct {
		Email    string `json:"email" validate:"required,email"`
		Password string `json:"password" validate:"required,min=8"`
	}

	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	tokens, err := h.AuthService.Login(req.Email, req.Password)
	if err != nil {
		log.Warn().Err(err).Str("email", req.Email).Msg("Login failed")
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Invalid credentials",
		})
	}

	return c.JSON(fiber.Map{
		"access_token":  tokens["access_token"],
		"refresh_token": tokens["refresh_token"],
		"token_type":    "Bearer",
	})
}

// Refresh handles token refresh requests
func (h *AuthHandler) Refresh(c fiber.Ctx) error {
	var req struct {
		RefreshToken string `json:"refresh_token" validate:"required"`
	}

	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	newAccessToken, err := h.AuthService.RefreshToken(req.RefreshToken)
	if err != nil {
		log.Warn().Err(err).Msg("Token refresh failed")
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Invalid or expired refresh token",
		})
	}

	return c.JSON(fiber.Map{
		"access_token": newAccessToken,
		"token_type":   "Bearer",
	})
}

// Activate handles account activation requests
func (h *AuthHandler) Activate(c fiber.Ctx) error {
	var req struct {
		Token    string `json:"token" validate:"required"`
		Password string `json:"password" validate:"required,min=12"`
	}

	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	err := h.AuthService.ActivateAccount(req.Token, req.Password)
	if err != nil {
		log.Error().Err(err).Msg("Account activation failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to activate account",
		})
	}

	return c.JSON(fiber.Map{
		"message": "Account activated successfully",
	})
}

// ForgotPassword handles password reset initiation requests
func (h *AuthHandler) ForgotPassword(c fiber.Ctx) error {
	var req struct {
		Email string `json:"email" validate:"required,email"`
	}

	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	err := h.AuthService.ForgotPassword(req.Email)
	if err != nil {
		log.Error().Err(err).Str("email", req.Email).Msg("Forgot password request failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to initiate password reset",
		})
	}

	return c.JSON(fiber.Map{
		"message": "Password reset instructions sent to your email",
	})
}

// ResetPassword handles password reset requests
func (h *AuthHandler) ResetPassword(c fiber.Ctx) error {
	var req struct {
		Token       string `json:"token" validate:"required"`
		NewPassword string `json:"new_password" validate:"required,min=12"`
	}

	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	err := h.AuthService.ResetPassword(req.Token, req.NewPassword)
	if err != nil {
		log.Error().Err(err).Msg("Password reset failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to reset password",
		})
	}

	return c.JSON(fiber.Map{
		"message": "Password reset successfully",
	})
}

// Me returns the authenticated user's information
func (h *AuthHandler) Me(c fiber.Ctx) error {
	userID, ok := c.Locals("userID").(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Unauthorized",
		})
	}

	parsedUserID, err := uuid.Parse(userID)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Invalid user ID",
		})
	}

	user, err := h.UserService.GetUserByID(parsedUserID)
	if err != nil {
		log.Error().Err(err).Str("user_id", userID).Msg("Failed to get user info")
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

// Logout handles user logout requests
func (h *AuthHandler) Logout(c fiber.Ctx) error {
	// In a real system, you would invalidate the refresh token
	// For now, we'll just return a success message

	return c.JSON(fiber.Map{
		"message": "Logged out successfully",
	})
}
