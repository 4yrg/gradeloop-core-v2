package handlers

import (
	"strings"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/application/usecases"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/application/utils"
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

type forgotPasswordRequest struct {
	Email string `json:"email"`
}

type resetPasswordRequest struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

type changePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

type storeTokensRequest struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	SessionID    string `json:"session_id"`
	CSRFToken    string `json:"csrf_token"`
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

	// Set secure HTTPOnly cookies for authentication
	h.setAuthCookies(c, accessToken, refreshToken, user.ID.String())

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
		"user":          user,
	})
}

// Refresh handles POST /refresh
func (h *AuthHandler) Refresh(c fiber.Ctx) error {
	// Get refresh token from HTTPOnly cookie instead of request body
	refreshTokenCookie := c.Cookies("__Secure-gl-refresh-token")
	if refreshTokenCookie == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "no refresh token found"})
	}

	accessToken, refreshToken, user, err := h.usecase.Refresh(c.Context(), refreshTokenCookie)
	if err != nil {
		// Specification: Return 401 Unauthorized for tokens that are expired, revoked, or non-matching
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": err.Error()})
	}

	// Set secure HTTPOnly cookies for refreshed authentication
	h.setAuthCookies(c, accessToken, refreshToken, user.ID.String())

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

// ForgotPassword handles POST /forgot-password
func (h *AuthHandler) ForgotPassword(c fiber.Ctx) error {
	var req forgotPasswordRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	if req.Email == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "email is required"})
	}

	if err := h.usecase.ForgotPassword(c.Context(), req.Email); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	// Always return success to prevent user enumeration
	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "if the email exists, a password reset link has been sent",
	})
}

// ResetPassword handles POST /reset-password
func (h *AuthHandler) ResetPassword(c fiber.Ctx) error {
	var req resetPasswordRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	if req.Token == "" || req.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "token and password are required"})
	}

	if err := h.usecase.ResetPassword(c.Context(), req.Token, req.Password); err != nil {
		if strings.Contains(err.Error(), "invalid") || strings.Contains(err.Error(), "expired") {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "password has been reset successfully",
	})
}

// ChangePassword handles PATCH /users/me/password
func (h *AuthHandler) ChangePassword(c fiber.Ctx) error {
	var req changePasswordRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	if req.CurrentPassword == "" || req.NewPassword == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "current password and new password are required"})
	}

	// Extract user ID from JWT token (set by auth middleware)
	userID := c.Locals("user_id")
	if userID == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "user not authenticated"})
	}

	userUUID, err := uuid.Parse(userID.(string))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid user ID"})
	}

	if err := h.usecase.ChangePassword(c.Context(), userUUID, req.CurrentPassword, req.NewPassword); err != nil {
		if strings.Contains(err.Error(), "incorrect") {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "password has been changed successfully",
	})
}

// StoreTokens handles POST /auth/store-tokens - stores tokens in HTTPOnly cookies
func (h *AuthHandler) StoreTokens(c fiber.Ctx) error {
	var req storeTokensRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid request body"})
	}

	if req.AccessToken == "" || req.RefreshToken == "" || req.SessionID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "access_token, refresh_token, and session_id are required"})
	}

	// Set secure HTTPOnly cookies
	h.setAuthCookies(c, req.AccessToken, req.RefreshToken, req.SessionID)

	// Set CSRF token as non-HTTPOnly cookie for client access
	if req.CSRFToken != "" {
		c.Cookie(&fiber.Cookie{
			Name:     "__Secure-gl-csrf-token",
			Value:    req.CSRFToken,
			MaxAge:   15 * 60, // 15 minutes
			HTTPOnly: false,   // Client needs access
			Secure:   true,
			SameSite: fiber.CookieSameSiteLaxMode,
			Path:     "/",
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "tokens stored successfully",
	})
}

// ClearTokens handles POST /auth/clear-tokens - clears HTTPOnly authentication cookies
func (h *AuthHandler) ClearTokens(c fiber.Ctx) error {
	// Clear all authentication cookies by setting them to expire immediately
	cookies := []string{
		"__Secure-gl-access-token",
		"__Secure-gl-refresh-token",
		"__Secure-gl-session-id",
		"__Secure-gl-csrf-token",
		"__Secure-gl-device-id",
	}

	for _, cookieName := range cookies {
		c.Cookie(&fiber.Cookie{
			Name:     cookieName,
			Value:    "",
			MaxAge:   -1, // Expire immediately
			HTTPOnly: true,
			Secure:   true,
			SameSite: fiber.CookieSameSiteLaxMode,
			Path:     "/",
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "tokens cleared successfully",
	})
}

// ValidateSession handles GET /auth/session - validates current session using HTTPOnly cookies
func (h *AuthHandler) ValidateSession(c fiber.Ctx) error {
	// Get access token from HTTPOnly cookie
	accessToken := c.Cookies("__Secure-gl-access-token")
	if accessToken == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"valid": false,
			"error": "no access token found",
		})
	}

	// Validate the JWT token
	claims, err := utils.ValidateAccessToken(accessToken, h.usecase.GetJWTSecret())
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"valid": false,
			"error": "invalid or expired token",
		})
	}

	// Get user details to ensure user is still active
	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"valid": false,
			"error": "invalid user ID in token",
		})
	}

	user, err := h.usecase.GetUserByID(c.Context(), userID)
	if err != nil || !user.IsActive {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"valid": false,
			"error": "user not found or inactive",
		})
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"valid": true,
		"user":  user,
	})
}

// Logout handles POST /auth/logout - clears authentication cookies and revokes tokens
func (h *AuthHandler) Logout(c fiber.Ctx) error {
	// Get refresh token from HTTPOnly cookie for revocation
	refreshToken := c.Cookies("__Secure-gl-refresh-token")

	// Try to revoke the refresh token if available
	if refreshToken != "" {
		// Note: This would require extending the usecase to support token revocation by token value
		// For now, we'll just clear the cookies
	}

	// Clear all authentication cookies
	h.clearAuthCookies(c)

	return c.Status(fiber.StatusOK).JSON(fiber.Map{
		"message": "logged out successfully",
	})
}

// Helper method to set authentication cookies
func (h *AuthHandler) setAuthCookies(c fiber.Ctx, accessToken, refreshToken, sessionID string) {
	// Set access token cookie (HTTPOnly, 15 minutes)
	c.Cookie(&fiber.Cookie{
		Name:     "__Secure-gl-access-token",
		Value:    accessToken,
		MaxAge:   15 * 60, // 15 minutes
		HTTPOnly: true,    // Security: not accessible from JavaScript
		Secure:   true,
		SameSite: fiber.CookieSameSiteLaxMode,
		Path:     "/",
	})

	// Set refresh token cookie (HTTPOnly, 30 days)
	c.Cookie(&fiber.Cookie{
		Name:     "__Secure-gl-refresh-token",
		Value:    refreshToken,
		MaxAge:   30 * 24 * 60 * 60, // 30 days
		HTTPOnly: true,              // Security: not accessible from JavaScript
		Secure:   true,
		SameSite: fiber.CookieSameSiteLaxMode,
		Path:     "/",
	})

	// Set session ID cookie (HTTPOnly, 30 days)
	c.Cookie(&fiber.Cookie{
		Name:     "__Secure-gl-session-id",
		Value:    sessionID,
		MaxAge:   30 * 24 * 60 * 60, // 30 days
		HTTPOnly: true,              // Security: not accessible from JavaScript
		Secure:   true,
		SameSite: fiber.CookieSameSiteLaxMode,
		Path:     "/",
	})
}

// Helper method to clear authentication cookies
func (h *AuthHandler) clearAuthCookies(c fiber.Ctx) {
	cookies := []string{
		"__Secure-gl-access-token",
		"__Secure-gl-refresh-token",
		"__Secure-gl-session-id",
		"__Secure-gl-csrf-token",
		"__Secure-gl-device-id",
	}

	for _, cookieName := range cookies {
		c.Cookie(&fiber.Cookie{
			Name:     cookieName,
			Value:    "",
			MaxAge:   -1, // Expire immediately
			HTTPOnly: true,
			Secure:   true,
			SameSite: fiber.CookieSameSiteLaxMode,
			Path:     "/",
		})
	}
}
