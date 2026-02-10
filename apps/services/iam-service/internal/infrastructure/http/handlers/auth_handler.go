package handlers

import (
	"strings"

	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/application/usecases"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/application/utils"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

type AuthHandler struct {
	usecase *usecases.AuthUsecase
}

func NewAuthHandler(usecase *usecases.AuthUsecase) *AuthHandler {
	return &AuthHandler{usecase: usecase}
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type activateRequest struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

type requestActivationRequest struct {
	Email string `json:"email"`
}

// Login handles POST /login
func (h *AuthHandler) Login(c fiber.Ctx) error {
	var req loginRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	accessToken, refreshToken, user, err := h.usecase.Login(c.Context(), req.Email, req.Password)
	if err != nil {
		// Specification: Return 401 Unauthorized for invalid credentials
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
		"user":          user,
	})
}

// Refresh handles POST /refresh
func (h *AuthHandler) Refresh(c fiber.Ctx) error {
	var req refreshRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	accessToken, refreshToken, user, err := h.usecase.Refresh(c.Context(), req.RefreshToken)
	if err != nil {
		// Specification: Return 401 Unauthorized for tokens that are expired, revoked, or non-matching
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
		"user":          user,
	})
}

// RevokeToken handles DELETE /refresh-tokens/{token_id}
func (h *AuthHandler) RevokeToken(c fiber.Ctx) error {
	idStr := c.Params("token_id")
	tokenID, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid token id"})
	}

	if err := h.usecase.RevokeToken(c.Context(), tokenID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to revoke token"})
	}

	// Specification: Revocation is idempotent
	return c.SendStatus(fiber.StatusNoContent)
}

// RevokeAllTokens handles POST /users/{id}/revoke-all-tokens
func (h *AuthHandler) RevokeAllTokens(c fiber.Ctx) error {
	idStr := c.Params("id")
	userID, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid user id"})
	}

	if err := h.usecase.RevokeAllUserTokens(c.Context(), userID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to revoke all tokens"})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

// Activate handles POST /activate
func (h *AuthHandler) Activate(c fiber.Ctx) error {
	var req activateRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	if err := h.usecase.ActivateAccount(c.Context(), req.Token, req.Password); err != nil {
		// Return 403 Forbidden and trigger alert log if a token is reused (handled in usecase)
		if err.Error() == "forbidden: token has already been used or is invalid" {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": err.Error()})
		}
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "account activated successfully"})
}

// RequestActivation handles POST /request-activation
func (h *AuthHandler) RequestActivation(c fiber.Ctx) error {
	var req requestActivationRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	if err := h.usecase.RequestActivation(c.Context(), req.Email); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "failed to request activation"})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"message": "if the email exists, an activation link has been sent"})
}

// ValidateToken handles GET /validate - ForwardAuth endpoint for Traefik
func (h *AuthHandler) ValidateToken(c fiber.Ctx) error {
	authHeader := c.Get("Authorization")
	if authHeader == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "missing authorization header"})
	}

	// Extract Bearer token
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid authorization header format"})
	}

	tokenStr := parts[1]
	if tokenStr == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "missing token"})
	}

	// Validate the JWT token using the same secret as token generation
	claims, err := utils.ValidateAccessToken(tokenStr, h.usecase.GetJWTSecret())
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid or expired token"})
	}

	// Get user details to ensure user is still active
	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "invalid user ID in token"})
	}

	user, err := h.usecase.GetUserByID(c.Context(), userID)
	if err != nil || !user.IsActive {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "user not found or inactive"})
	}

	// Set response headers for Traefik ForwardAuth
	c.Set("X-User-Id", claims.Subject)
	c.Set("X-User-Roles", strings.Join(claims.Roles, ","))
	c.Set("X-User-Permissions", strings.Join(claims.Permissions, ","))
	c.Set("X-User-Email", user.Email)
	c.Set("X-User-Name", user.FullName)

	// Return 200 OK for successful validation
	return c.SendStatus(fiber.StatusOK)
}
