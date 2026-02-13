package middleware

import (
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/application/ports"
	"github.com/redis/go-redis/v9"
	"github.com/gofiber/fiber/v3"
)

// BruteForceProtection is intentionally disabled in development to avoid
// blocking authentication flows. It preserves the original function
// signature so callers/registrations don't require changes.
func BruteForceProtection(redisClient *redis.Client, auditRepo ports.AuditRepository) fiber.Handler {
	return func(c fiber.Ctx) error {
		return c.Next()
	}
}
