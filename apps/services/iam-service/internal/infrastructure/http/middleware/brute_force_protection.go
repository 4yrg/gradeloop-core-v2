package middleware

import (
	"context"
	"fmt"
	"time"

	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/application/ports"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	gl_logger "github.com/4YRG/gradeloop-core-v2/shared/libs/go/logger"
	"github.com/redis/go-redis/v9"
	"github.com/gofiber/fiber/v3"
)

const (
	maxAttempts  = 5
	lockoutTime  = 15 * time.Minute
	redisTimeout = 5 * time.Millisecond // Performance requirement: < 5ms
)

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// BruteForceProtection implements rate limiting for authentication endpoints
// Tracks failed attempts per IP + username and enforces temporary lockouts
func BruteForceProtection(redisClient *redis.Client, auditRepo ports.AuditRepository) fiber.Handler {
	logger := gl_logger.New("iam-service")

	return func(c fiber.Ctx) error {
		ip := c.IP()
		var loginReq LoginRequest

		// Use c.Bind().Body() to parse the request body
		if err := c.Bind().Body(&loginReq); err != nil {
			// If body parsing fails, proceed to the next handler
			// The handler will likely return a BadRequest error
			return c.Next()
		}

		// Proceed if email is empty, let the handler validate the request
		if loginReq.Email == "" {
			return c.Next()
		}

		key := fmt.Sprintf("auth_fail:%s:%s", ip, loginReq.Email)
		ctx := c.Context()

		// Check if the account is currently locked with timeout
		redisCtx, cancel := context.WithTimeout(ctx, redisTimeout)
		defer cancel()

		startTime := time.Now()
		attempts, err := redisClient.Get(redisCtx, key).Int64()
		redisDuration := time.Since(startTime)

		// Performance monitoring: warn if Redis operation exceeds threshold
		if redisDuration > redisTimeout {
			logger.Warn("Redis operation exceeded latency threshold",
				"duration_ms", redisDuration.Milliseconds(),
				"threshold_ms", redisTimeout.Milliseconds(),
				"ip", ip,
				"email", loginReq.Email,
			)
		}

		if err != nil && err != redis.Nil {
			// Fail-safe mode: If Redis is unavailable, allow authentication to proceed
			// but log a high-priority warning
			logger.Error("Redis unavailable - operating in degraded mode",
				"error", err,
				"ip", ip,
				"email", loginReq.Email,
			)

			// Log to audit system
			auditLog := &models.AuditLog{
				Action:    "auth.redis.failure",
				Entity:    "brute_force_protection",
				EntityID:  loginReq.Email,
				IPAddress: ip,
				UserAgent: string(c.Request().Header.UserAgent()),
				NewValue:  []byte(fmt.Sprintf(`{"error": "%s", "degraded_mode": true}`, err.Error())),
			}
			_ = auditRepo.CreateAuditLog(ctx, auditLog)

			// Allow request to proceed in degraded mode
			return c.Next()
		}

		// Check if account is locked
		if attempts >= maxAttempts {
			// Anti-enumeration: Use standardized error message
			logger.Info("Account temporarily locked due to brute-force protection",
				"ip", ip,
				"email", loginReq.Email,
				"attempts", attempts,
			)

			// Log lockout event to audit system
			auditLog := &models.AuditLog{
				Action:    "auth.login.locked",
				Entity:    "users",
				EntityID:  loginReq.Email,
				IPAddress: ip,
				UserAgent: string(c.Request().Header.UserAgent()),
				NewValue:  []byte(fmt.Sprintf(`{"attempts": %d, "max_attempts": %d}`, attempts, maxAttempts)),
			}
			_ = auditRepo.CreateAuditLog(ctx, auditLog)

			// Return standardized error message (anti-enumeration)
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error": "Account temporarily locked",
			})
		}

		// Proceed to the next handler (the actual login handler)
		err = c.Next()

		// After the handler has run, check the response status code
		if c.Response().StatusCode() == fiber.StatusUnauthorized {
			// Failed login attempt - increment counter
			redisCtx, cancel := context.WithTimeout(ctx, redisTimeout)
			defer cancel()

			redisClient.Incr(redisCtx, key)
			redisClient.Expire(redisCtx, key, lockoutTime)

			newAttempts := attempts + 1
			logger.Info("Failed login attempt recorded",
				"ip", ip,
				"email", loginReq.Email,
				"attempts", newAttempts,
				"max_attempts", maxAttempts,
			)

			// Log failed attempt to audit system
			auditLog := &models.AuditLog{
				Action:    "auth.login.failed",
				Entity:    "users",
				EntityID:  loginReq.Email,
				IPAddress: ip,
				UserAgent: string(c.Request().Header.UserAgent()),
				NewValue:  []byte(fmt.Sprintf(`{"attempts": %d, "max_attempts": %d}`, newAttempts, maxAttempts)),
			}
			_ = auditRepo.CreateAuditLog(ctx, auditLog)

		} else if c.Response().StatusCode() == fiber.StatusOK {
			// Successful login - reset counter
			redisCtx, cancel := context.WithTimeout(ctx, redisTimeout)
			defer cancel()

			redisClient.Del(redisCtx, key)

			logger.Info("Successful login - counter reset",
				"ip", ip,
				"email", loginReq.Email,
			)

			// Log successful login counter reset to audit system
			auditLog := &models.AuditLog{
				Action:    "auth.login.success",
				Entity:    "users",
				EntityID:  loginReq.Email,
				IPAddress: ip,
				UserAgent: string(c.Request().Header.UserAgent()),
				NewValue:  []byte(`{"counter_reset": true}`),
			}
			_ = auditRepo.CreateAuditLog(ctx, auditLog)
		}

		return err
	}
}
