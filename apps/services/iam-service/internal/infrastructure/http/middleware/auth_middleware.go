package middleware

import (
	"github.com/gofiber/fiber/v3"
)

// AdminOnly middleware ensures that only users with admin status can access the decorated endpoints.
// In a real-world scenario, this would extract the user's role/status from a JWT token or session.
// For this implementation, it looks for a "is_admin" claim or header, consistent with IAM service requirements.
func AdminOnly() fiber.Handler {
	return func(ctx fiber.Ctx) error {
		// This is a placeholder for actual JWT/Session extraction logic.
		// Usually, an upstream Auth middleware would have populated the locals.
		isAdmin := ctx.Get("X-Is-Admin") == "true" || ctx.Locals("is_admin") == true

		if !isAdmin {
			return ctx.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "Forbidden: Only administrators can perform this action",
			})
		}

		return ctx.Next()
	}
}
