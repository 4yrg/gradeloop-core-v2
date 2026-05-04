package handler

import (
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/dto"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/service"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

type AuthHandler struct {
	authService        service.AuthService
	userService        service.UserService
	passwordService    service.PasswordService
	githubService      *service.GitHubService
	cookieSecure       bool
	cookieSameSite     string
	refreshTokenExpiry time.Duration
}

func NewAuthHandler(
	authService service.AuthService,
	userService service.UserService,
	passwordService service.PasswordService,
	githubService *service.GitHubService,
	cookieSecure bool,
	cookieSameSite string,
	refreshTokenExpiryDays int64,
) *AuthHandler {
	return &AuthHandler{
		authService:        authService,
		userService:        userService,
		passwordService:    passwordService,
		githubService:      githubService,
		cookieSecure:       cookieSecure,
		cookieSameSite:     cookieSameSite,
		refreshTokenExpiry: time.Duration(refreshTokenExpiryDays) * 24 * time.Hour,
	}
}

func (h *AuthHandler) RegisterRoutes(app *fiber.App) {
	auth := app.Group("/auth")

	auth.Post("/login", h.Login)
	auth.Post("/refresh", h.RefreshToken)
	auth.Post("/logout", h.Logout)
	auth.Post("/forgot-password", h.ForgotPassword)
	auth.Post("/reset-password", h.ResetPassword)
	auth.Post("/change-password", h.ChangePassword)

	auth.Get("/github", h.GetGitHubAuthURL)
	auth.Get("/github/callback", h.GitHubCallback)
}

// RegisterAdminRoutes registers admin-only routes
func (h *AuthHandler) RegisterAdminRoutes(router fiber.Router) {
	router.Post("/admin/users/:id/revoke-sessions", h.RevokeUserSessions)
}

func (h *AuthHandler) Login(c fiber.Ctx) error {
	var req dto.LoginRequest

	if err := c.Bind().Body(&req); err != nil {
		return fiber.ErrBadRequest
	}

	if req.Email == "" || req.Password == "" {
		return fiber.ErrBadRequest
	}

	response, err := h.authService.Login(c.RequestCtx(), req.Email, req.Password)
	if err != nil {
		return handleAuthError(err)
	}

	// Set refresh token in httpOnly cookie
	cookie := new(fiber.Cookie)
	cookie.Name = "refresh_token"
	cookie.Value = response.RefreshToken
	cookie.Path = "/"
	cookie.Expires = time.Now().Add(h.refreshTokenExpiry)
	cookie.HTTPOnly = true
	cookie.Secure = h.cookieSecure
	cookie.SameSite = h.cookieSameSite

	c.Cookie(cookie)

	// Clear refresh token from body (omitempty will hide it in JSON)
	response.RefreshToken = ""

	return c.JSON(response)
}

func (h *AuthHandler) RefreshToken(c fiber.Ctx) error {
	// Get refresh token from cookie
	refreshToken := c.Cookies("refresh_token")
	if refreshToken == "" {
		return fiber.NewError(fiber.StatusUnauthorized, "No refresh token provided")
	}

	response, err := h.authService.RefreshToken(c.RequestCtx(), refreshToken)
	if err != nil {
		return handleAuthError(err)
	}

	// Set new refresh token in httpOnly cookie
	cookie := new(fiber.Cookie)
	cookie.Name = "refresh_token"
	cookie.Value = response.RefreshToken
	cookie.Path = "/"
	cookie.Expires = time.Now().Add(h.refreshTokenExpiry)
	cookie.HTTPOnly = true
	cookie.Secure = h.cookieSecure
	cookie.SameSite = h.cookieSameSite

	c.Cookie(cookie)

	// Clear refresh token from body (omitempty will hide it in JSON)
	response.RefreshToken = ""

	return c.JSON(response)
}

func (h *AuthHandler) Logout(c fiber.Ctx) error {
	refreshToken := c.Cookies("refresh_token")
	if refreshToken == "" {
		return fiber.ErrBadRequest
	}

	if err := h.authService.Logout(c.RequestCtx(), refreshToken); err != nil {
		return handleAuthError(err)
	}

	// Clear refresh token cookie
	cookie := new(fiber.Cookie)
	cookie.Name = "refresh_token"
	cookie.Path = "/"
	cookie.Expires = time.Now().Add(-1 * time.Hour)
	cookie.HTTPOnly = true
	cookie.Secure = h.cookieSecure
	cookie.SameSite = h.cookieSameSite

	c.Cookie(cookie)

	return c.JSON(fiber.Map{
		"message": "logged out successfully",
	})
}

func (h *AuthHandler) ChangePassword(c fiber.Ctx) error {
	var req dto.ChangePasswordRequest

	if err := c.Bind().Body(&req); err != nil {
		return fiber.ErrBadRequest
	}

	// Get user ID from context (set by AuthMiddleware)
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok || userIDStr == "" {
		return fiber.NewError(fiber.StatusUnauthorized, "Unauthorized")
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return fiber.NewError(fiber.StatusUnauthorized, "Unauthorized")
	}

	response, err := h.passwordService.ChangePassword(c.RequestCtx(), userID, req.CurrentPassword, req.NewPassword)
	if err != nil {
		return handleAuthError(err)
	}

	return c.JSON(response)
}

func (h *AuthHandler) ForgotPassword(c fiber.Ctx) error {
	var req dto.ForgotPasswordRequest

	if err := c.Bind().Body(&req); err != nil {
		return fiber.ErrBadRequest
	}

	response, err := h.passwordService.ForgotPassword(c.RequestCtx(), req.Email)
	if err != nil {
		return handleAuthError(err)
	}

	return c.JSON(response)
}

func (h *AuthHandler) ResetPassword(c fiber.Ctx) error {
	var req dto.ResetPasswordRequest

	if err := c.Bind().Body(&req); err != nil {
		return fiber.ErrBadRequest
	}

	response, err := h.passwordService.ResetPassword(c.RequestCtx(), req.Token, req.NewPassword)
	if err != nil {
		return handleAuthError(err)
	}

	return c.JSON(response)
}

func (h *AuthHandler) RevokeUserSessions(c fiber.Ctx) error {
	userID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	// Get actor user type from context
	userType, ok := c.Locals("user_type").(string)
	if !ok || userType == "" {
		return fiber.NewError(fiber.StatusForbidden, "Permission denied")
	}

	response, err := h.authService.RevokeUserSessions(c.RequestCtx(), userID, userType)
	if err != nil {
		return handleAuthError(err)
	}

	return c.JSON(response)
}

func (h *AuthHandler) GetGitHubAuthURL(c fiber.Ctx) error {
	url := h.githubService.GetAuthURL()
	return c.JSON(dto.GitHubAuthURLResponse{URL: url})
}

func (h *AuthHandler) GitHubCallback(c fiber.Ctx) error {
	code := c.Query("code")
	if code == "" {
		return fiber.NewError(fiber.StatusBadRequest, "No code provided")
	}

	tokenResp, err := h.githubService.ExchangeCodeForToken(c.RequestCtx(), code)
	if err != nil {
		return fiber.NewError(fiber.StatusUnauthorized, "Failed to exchange code for token")
	}

	githubUser, err := h.githubService.GetGitHubUser(c.RequestCtx(), tokenResp.AccessToken)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to get GitHub user")
	}

	email, err := h.githubService.GetUserEmail(c.RequestCtx(), tokenResp.AccessToken)
	if err != nil {
		email = githubUser.Email
	}

	user, err := h.userService.FindByEmail(email)
	if err != nil {
		return fiber.NewError(fiber.StatusNotFound, "No account found. Please register first or link GitHub in profile.")
	}

	if err := h.githubService.LinkGitHubToUser(user, tokenResp.AccessToken); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to link GitHub account")
	}

	if err := h.userService.Update(user); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "Failed to save GitHub info")
	}

	authResponse, err := h.authService.LoginWithUser(c.RequestCtx(), user)
	if err != nil {
		return handleAuthError(err)
	}

	cookie := new(fiber.Cookie)
	cookie.Name = "refresh_token"
	cookie.Value = authResponse.RefreshToken
	cookie.Path = "/"
	cookie.Expires = time.Now().Add(h.refreshTokenExpiry)
	cookie.HTTPOnly = true
	cookie.Secure = h.cookieSecure
	cookie.SameSite = h.cookieSameSite

	c.Cookie(cookie)

	authResponse.RefreshToken = ""

	return c.JSON(authResponse)
}

func handleAuthError(err error) error {
	switch err {
	case service.ErrInvalidCredentials:
		return fiber.NewError(fiber.StatusUnauthorized, "Invalid email or password")
	case service.ErrUserInactive:
		return fiber.NewError(fiber.StatusForbidden, "User account is inactive")
	case service.ErrPasswordResetRequired:
		return fiber.NewError(fiber.StatusForbidden, "Password reset required")
	case service.ErrUserNotFound:
		return fiber.NewError(fiber.StatusNotFound, "User not found")
	case service.ErrRefreshTokenNotFound, service.ErrRefreshTokenExpired, service.ErrRefreshTokenRevoked:
		return fiber.NewError(fiber.StatusUnauthorized, "Invalid or expired refresh token") // removed activation token errors
	case service.ErrCurrentPasswordInvalid:
		return fiber.NewError(fiber.StatusUnauthorized, "Current password is incorrect")
	case service.ErrNewPasswordSameAsOld:
		return fiber.NewError(fiber.StatusBadRequest, "New password must be different from current password")
	case service.ErrPasswordTooWeak:
		return fiber.NewError(fiber.StatusBadRequest, "Password does not meet security requirements. Must be at least 8 characters with uppercase, lowercase, number, and special character.")
	case service.ErrPasswordResetTokenInvalid:
		return fiber.NewError(fiber.StatusBadRequest, "Invalid password reset token")
	case service.ErrPasswordResetTokenExpired:
		return fiber.NewError(fiber.StatusBadRequest, "Password reset token has expired")
	case service.ErrPasswordResetLinkExpiredResent:
		return fiber.NewError(fiber.StatusBadRequest, "Your reset link has expired. A new link has been sent to your email.")
	case service.ErrPasswordResetTokenUsed:
		return fiber.NewError(fiber.StatusBadRequest, "Password reset token has already been used")
	default:
		return err
	}
}
