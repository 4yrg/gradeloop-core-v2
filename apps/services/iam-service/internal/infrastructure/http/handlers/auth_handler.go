package handlers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/application/usecases"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

type AuthHandler struct {
	usecase usecases.AuthUsecase
}

func NewAuthHandler(uc usecases.AuthUsecase) *AuthHandler {
	return &AuthHandler{usecase: uc}
}

type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=8"`
}

type LoginResponse struct {
	AccessToken string      `json:"access_token"`
	User        interface{} `json:"user"`
}

type ForgotPasswordRequest struct {
	Email string `json:"email" validate:"required,email"`
}

type ResetPasswordRequest struct {
	Token       string `json:"token" validate:"required"`
	NewPassword string `json:"new_password" validate:"required,min=8"`
}

type ActivateRequest struct {
	Token    string `json:"token" validate:"required"`
	Password string `json:"password" validate:"required,min=8"`
}

type RequestActivationRequest struct {
	Email string `json:"email" validate:"required,email"`
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password" validate:"required,min=8"`
	NewPassword     string `json:"new_password" validate:"required,min=8"`
}

func (h *AuthHandler) Login(c fiber.Ctx) error {
	var req LoginRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// Basic validation
	if req.Email == "" || req.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Email and password are required",
		})
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()

	accessToken, refreshToken, user, err := h.usecase.Login(ctx, req.Email, req.Password)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	// Set access and refresh tokens as HTTPOnly cookies for web app compatibility
	c.Cookie(&fiber.Cookie{
		Name:     "__Secure-gl-access-token",
		Value:    accessToken,
		HTTPOnly: true,
		Secure:   c.Protocol() == "https",
		SameSite: "Lax",
		MaxAge:   900, // 15 minutes
	})

	c.Cookie(&fiber.Cookie{
		Name:     "__Secure-gl-refresh-token",
		Value:    refreshToken,
		HTTPOnly: true,
		Secure:   c.Protocol() == "https",
		SameSite: "Lax",
		MaxAge:   2592000, // 30 days
	})

	return c.JSON(LoginResponse{
		AccessToken: accessToken,
		User:        user,
	})
}

func (h *AuthHandler) Refresh(c fiber.Ctx) error {
	// Extract refresh token from the cookie (try both naming conventions)
	refreshToken := c.Cookies("__Secure-gl-refresh-token")
	if refreshToken == "" {
		refreshToken = c.Cookies("refresh_token")
	}
	if refreshToken == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Refresh token not found",
		})
	}

	// Call the usecase to refresh the token
	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()

	newAccessToken, newRefreshToken, user, err := h.usecase.Refresh(ctx, refreshToken)
	if err != nil {
		// If refresh token validation fails, clear all cookies
		c.ClearCookie("__Secure-gl-access-token")
		c.ClearCookie("__Secure-gl-refresh-token")
		c.ClearCookie("__Secure-gl-session-id")

		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	// Set new tokens as cookies (using web app naming convention)
	c.Cookie(&fiber.Cookie{
		Name:     "__Secure-gl-access-token",
		Value:    newAccessToken,
		HTTPOnly: true,
		Secure:   c.Protocol() == "https", // Secure in production
		SameSite: "Lax",
		MaxAge:   900, // 15 minutes
	})

	if newRefreshToken != "" {
		c.Cookie(&fiber.Cookie{
			Name:     "__Secure-gl-refresh-token",
			Value:    newRefreshToken,
			HTTPOnly: true,
			Secure:   c.Protocol() == "https", // Secure in production
			SameSite: "Lax",
			MaxAge:   2592000, // 30 days
		})
	}

	return c.JSON(fiber.Map{
		"access_token":  newAccessToken,
		"refresh_token": newRefreshToken,
		"user":          user,
	})
}

func (h *AuthHandler) RevokeToken(c fiber.Ctx) error {
	tokenIDStr := c.Params("token_id")
	if tokenIDStr == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Token ID is required",
		})
	}

	tokenID, err := uuid.Parse(tokenIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid token ID format",
		})
	}

	ctx, cancel := context.WithTimeout(c.Context(), 5*time.Second)
	defer cancel()

	if err := h.usecase.RevokeToken(ctx, tokenID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"message": "Token revoked successfully",
	})
}

func (h *AuthHandler) Activate(c fiber.Ctx) error {
	var req ActivateRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()

	if err := h.usecase.ActivateAccount(ctx, req.Token, req.Password); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "Account activated successfully",
	})
}

func (h *AuthHandler) RequestActivation(c fiber.Ctx) error {
	var req RequestActivationRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()

	if err := h.usecase.RequestActivation(ctx, req.Email); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "Activation request sent",
	})
}

func (h *AuthHandler) ForgotPassword(c fiber.Ctx) error {
	var req ForgotPasswordRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	ctx, cancel := context.WithTimeout(c.Context(), 11*time.Second)
	defer cancel()

	if err := h.usecase.ForgotPassword(ctx, req.Email); err != nil {
		// Log the error but return a generic response to prevent email enumeration
		fmt.Printf("ForgotPassword error: %v\n", err)
		return c.JSON(fiber.Map{
			"message": "If your email exists in our system, you will receive a password reset link shortly",
		})
	}

	return c.JSON(fiber.Map{
		"message": "If your email exists in our system, you will receive a password reset link shortly",
	})
}

func (h *AuthHandler) ResetPassword(c fiber.Ctx) error {
	var req ResetPasswordRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()

	if err := h.usecase.ResetPassword(ctx, req.Token, req.NewPassword); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "Password reset successfully",
	})
}

func (h *AuthHandler) ValidateToken(c fiber.Ctx) error {
	// Extract user from context (this is typically called by the gateway for forward auth)
	user := c.Locals("user")
	if user == nil {
		// Return 401 to indicate token is invalid
		return c.Status(fiber.StatusUnauthorized).SendString("Unauthorized")
	}

	// Return 200 to indicate token is valid
	return c.SendString("OK")
}

func (h *AuthHandler) StoreTokens(c fiber.Ctx) error {
	var req struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		SessionID    string `json:"session_id"`
		CsrfToken    string `json:"csrf_token"`
	}

	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// Set HTTPOnly cookies for tokens (using web app naming convention)
	c.Cookie(&fiber.Cookie{
		Name:     "__Secure-gl-access-token",
		Value:    req.AccessToken,
		HTTPOnly: true,
		Secure:   c.Protocol() == "https", // Secure in production
		SameSite: "Lax",
		MaxAge:   900, // 15 minutes
	})

	c.Cookie(&fiber.Cookie{
		Name:     "__Secure-gl-refresh-token",
		Value:    req.RefreshToken,
		HTTPOnly: true,
		Secure:   c.Protocol() == "https", // Secure in production
		SameSite: "Lax",
		MaxAge:   2592000, // 30 days
	})

	c.Cookie(&fiber.Cookie{
		Name:     "__Secure-gl-session-id",
		Value:    req.SessionID,
		HTTPOnly: true,
		Secure:   c.Protocol() == "https", // Secure in production
		SameSite: "Lax",
		MaxAge:   2592000, // 30 days
	})

	return c.JSON(fiber.Map{
		"message": "Tokens stored successfully",
	})
}

func (h *AuthHandler) ClearTokens(c fiber.Ctx) error {
	// Clear HTTPOnly cookies for tokens
	c.ClearCookie("__Secure-gl-access-token")
	c.ClearCookie("__Secure-gl-refresh-token")
	c.ClearCookie("__Secure-gl-session-id")

	return c.JSON(fiber.Map{
		"message": "Tokens cleared successfully",
	})
}

func (h *AuthHandler) ValidateSession(c fiber.Ctx) error {
	// Extract user from context (assuming auth middleware has already validated)
	user := c.Locals("user")
	if user == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"valid": false,
		})
	}

	// Return session validation result
	return c.JSON(fiber.Map{
		"valid": true,
		"user":  user,
	})
}

func (h *AuthHandler) Logout(c fiber.Ctx) error {
	// Extract user from context to log out the session
	userInterface := c.Locals("user")
	if userInterface == nil {
		// Even if no user is logged in, return success
		return c.JSON(fiber.Map{
			"message": "Logged out successfully",
		})
	}

	// Attempt to extract user ID from the user object
	userID := uuid.Nil
	switch u := userInterface.(type) {
	case map[string]interface{}:
		if idStr, ok := u["id"].(string); ok {
			if parsedID, err := uuid.Parse(idStr); err == nil {
				userID = parsedID
			}
		}
	case *map[string]interface{}:
		if idStr, ok := (*u)["id"].(string); ok {
			if parsedID, err := uuid.Parse(idStr); err == nil {
				userID = parsedID
			}
		}
	}

	// Clear HTTPOnly cookies for tokens
	c.ClearCookie("__Secure-gl-access-token")
	c.ClearCookie("__Secure-gl-refresh-token")
	c.ClearCookie("__Secure-gl-session-id")

	// If we have a valid user ID, revoke all tokens for that user
	if userID != uuid.Nil {
		ctx, cancel := context.WithTimeout(c.Context(), 5*time.Second)
		defer cancel()

		if err := h.usecase.Logout(ctx, userID); err != nil {
			// Log error but don't fail the logout
			fmt.Printf("Error revoking user tokens: %v\n", err)
		}
	}

	return c.JSON(fiber.Map{
		"message": "Logged out successfully",
	})
}

func (h *AuthHandler) ChangePassword(c fiber.Ctx) error {
	userIDInterface := c.Locals("user_id")
	if userIDInterface == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "User not authenticated",
		})
	}

	userIDStr, ok := userIDInterface.(string)
	if !ok {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Invalid user ID format",
		})
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Invalid user ID",
		})
	}

	var req ChangePasswordRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	ctx, cancel := context.WithTimeout(c.Context(), 10*time.Second)
	defer cancel()

	if err := h.usecase.ChangePassword(ctx, userID, req.CurrentPassword, req.NewPassword); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "Password changed successfully",
	})
}