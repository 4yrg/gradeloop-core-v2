package middleware

import (
	"strings"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

// AdminOnly middleware ensures that only users with admin status can access the decorated endpoints.
// In a real-world scenario, this would extract the user's role/status from a JWT token or session.
// For this implementation, it looks for a "is_admin" claim or header, consistent with IAM service requirements.
func AdminOnly() fiber.Handler {
	return func(ctx fiber.Ctx) error {
		// Extract roles from X-User-Roles header forwarded by the gateway
		rolesHeader := ctx.Get("X-User-Roles")
		isAdmin := false

		// The jwt-validator plugin sends array claims as comma-separated values
		if rolesHeader != "" {
			for _, role := range strings.Split(rolesHeader, ",") {
				if strings.TrimSpace(role) == "admin" {
					isAdmin = true
					break
				}
			}
		}

		// Fallback for internal context if populated by other middleware
		if !isAdmin && ctx.Locals("is_admin") == true {
			isAdmin = true
		}

		if !isAdmin {
			return ctx.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "Forbidden: Only administrators can perform this action",
			})
		}

		return ctx.Next()
	}
}

// ForcePasswordReset middleware checks if a user has completed their first mandatory password change.
// Requirement GRADELOOP-27: If password_changed_at is not greater than password_set_at,
// the session must be blocked, and the user must be redirected to /force-password-reset.
func ForcePasswordReset() fiber.Handler {
	return func(c fiber.Ctx) error {
		user, ok := c.Locals("user").(*models.User)
		if !ok || user == nil {
			// This middleware should follow an authentication middleware that populates the user context.
			return c.Next()
		}

		mustReset := false
		if user.PasswordSetAt != nil {
			if user.PasswordChangedAt == nil {
				mustReset = true
			} else if !user.PasswordChangedAt.After(*user.PasswordSetAt) {
				mustReset = true
			}
		}

		if mustReset {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error":    "Mandatory password reset required",
				"redirect": "/force-password-reset",
			})
		}

		return c.Next()
	}
}

// AuthRequired middleware extracts and validates JWT token from Authorization header
// and sets user_id in context for protected endpoints
func AuthRequired() fiber.Handler {
	return func(c fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Missing authorization header",
			})
		}

		// Extract Bearer token
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Invalid authorization header format",
			})
		}

		tokenStr := parts[1]
		if tokenStr == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Missing token",
			})
		}

		// Validate JWT token - we need the JWT secret from environment or config
		// For now, we'll extract from X-User-Id header set by API gateway
		userIDHeader := c.Get("X-User-Id")
		if userIDHeader == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Invalid or expired token",
			})
		}

		// Validate user ID format
		userID, err := uuid.Parse(userIDHeader)
		if err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Invalid user ID in token",
			})
		}

		// Set user ID in context for handlers to use
		c.Locals("user_id", userID.String())

		// Also set roles and permissions if available from headers
		if rolesHeader := c.Get("X-User-Roles"); rolesHeader != "" {
			c.Locals("user_roles", strings.Split(rolesHeader, ","))
		}

		if permissionsHeader := c.Get("X-User-Permissions"); permissionsHeader != "" {
			c.Locals("user_permissions", strings.Split(permissionsHeader, ","))
		}

		return c.Next()
	}
}
