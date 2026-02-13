package middleware

import (
	"fmt"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/application/ports"
	"github.com/gofiber/fiber/v3"
	"github.com/redis/go-redis/v9"
)

const (
	MaxAttempts = 5
	BlockDuration = 15 * time.Minute
	AttemptWindow = 15 * time.Minute
)

// BruteForceProtection implements rate limiting for authentication endpoints
func BruteForceProtection(redisClient *redis.Client, auditRepo ports.AuditRepository) fiber.Handler {
	return func(c fiber.Ctx) error {
		// Only apply brute force protection to specific endpoints
		path := c.Path()
		method := c.Method()
		
		// Apply to login and other auth endpoints that are susceptible to brute force
		isAuthEndpoint := (path == "/api/v1/auth/login" || 
			path == "/api/v1/auth/forgot-password" ||
			path == "/api/v1/auth/activate")
		
		if !isAuthEndpoint || method != "POST" {
			return c.Next()
		}

		// Get client IP
		clientIP := getClientIP(c)

		// Create a key for this IP and endpoint combination
		key := fmt.Sprintf("bruteforce:%s:%s", clientIP, path)
		
		// Use Redis to track attempts
		current, err := redisClient.Get(c.Context(), key).Int()
		if err != nil && err != redis.Nil {
			// If Redis is unavailable, allow the request to proceed
			return c.Next()
		}

		if current >= MaxAttempts {
			// Check if the key has expired
			ttl, err := redisClient.TTL(c.Context(), key).Result()
			if err != nil || ttl <= 0 {
				// TTL expired, reset counter
				pipe := redisClient.TxPipeline()
				pipe.SetEx(c.Context(), key, "1", AttemptWindow)
				pipe.Exec(c.Context())
				return c.Next()
			}
			
			// Still blocked
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error": "Too many attempts, please try again later",
			})
		}

		// Increment the attempt counter
		if current == 0 {
			// First attempt, set with expiration
			redisClient.SetEx(c.Context(), key, "1", AttemptWindow)
		} else {
			// Increment existing counter
			redisClient.Incr(c.Context(), key)
		}

		// Proceed with the request
		return c.Next()
	}
}

// getClientIP extracts the client IP from various headers
func getClientIP(c fiber.Ctx) string {
	// Try different headers for client IP
	forwarded := c.Get("X-Forwarded-For")
	if forwarded != "" {
		// Take the first IP if multiple are present
		if idx := indexOf(forwarded, ","); idx != -1 {
			return forwarded[:idx]
		}
		return forwarded
	}

	realIP := c.Get("X-Real-IP")
	if realIP != "" {
		return realIP
	}

	cfConnectingIP := c.Get("CF-Connecting-IP")
	if cfConnectingIP != "" {
		return cfConnectingIP
	}

	// Fall back to the remote IP
	return c.IP()
}

// indexOf finds the position of a character in a string
func indexOf(str string, char string) int {
	for i := 0; i < len(str); i++ {
		if string(str[i]) == char {
			return i
		}
	}
	return -1
}