package middleware

import (
	"log"

	"github.com/gofiber/fiber/v3"
)

// CSRFMiddleware implements the double-submit cookie pattern for CSRF protection.
// It requires that mutating requests (POST, PUT, PATCH, DELETE) include a valid
// X-CSRF-Token header that matches the csrf_token cookie.
//
// Usage:
//
//	app.Use(CSRFMiddleware())
//
// Note: This middleware should be applied after your auth middleware but before
// your route handlers. GET and HEAD requests are exempted from CSRF checks.
func CSRFMiddleware() fiber.Handler {
	return func(c fiber.Ctx) error {
		// Skip CSRF check for safe methods
		if c.Method() == fiber.MethodGet || c.Method() == fiber.MethodHead {
			return c.Next()
		}

		// Get CSRF token from cookie (set by server during login/refresh)
		cookieToken := c.Cookies("csrf_token")

		// Get CSRF token from header (sent by client JS)
		headerToken := c.Get("X-CSRF-Token")

		// Validate: both must be present and match
		if cookieToken == "" || headerToken == "" || cookieToken != headerToken {
			// Log CSRF failure for security monitoring
			log.Printf("[CSRF] Validation failed - path: %s, method: %s, cookie_present: %v, header_present: %v, match: %v",
				c.Path(), c.Method(), cookieToken != "", headerToken != "", cookieToken == headerToken)
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "Invalid CSRF token",
			})
		}

		return c.Next()
	}
}
