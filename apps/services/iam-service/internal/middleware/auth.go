package middleware

import (
	"errors"
	"log"
	"os"
	"strings"

	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
)

// AuthMiddleware validates the JWT token and sets the user context.
// It accepts tokens from either:
// 1. Authorization header (Bearer <token>) - primary for API clients
// 2. access_token cookie - primary for browser-based clients
func AuthMiddleware() fiber.Handler {
	return func(c fiber.Ctx) error {
		// Priority: Authorization header > access_token cookie
		var tokenString string
		tokenSource := "cookie"

		authHeader := c.Get("Authorization")
		if authHeader != "" {
			tokenString = strings.TrimPrefix(authHeader, "Bearer ")
			if tokenString == authHeader {
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid token format"})
			}
			tokenSource = "header"
		} else {
			tokenString = c.Cookies("access_token")
		}

		if tokenString == "" {
			// Log authentication failure for monitoring
			log.Printf("[AUTH] Missing token - path: %s, method: %s", c.Path(), c.Method())
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Missing authentication token"})
		}

		secret := os.Getenv("SECRET")
		if secret == "" {
			// Log server configuration error
			log.Printf("[AUTH] Server configuration error - SECRET not set")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Server configuration error"})
		}

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, errors.New("unexpected signing method")
			}
			return []byte(secret), nil
		})

		if err != nil || !token.Valid {
			// Log invalid token attempt for security monitoring
			log.Printf("[AUTH] Invalid token - path: %s, method: %s, source: %s, error: %v",
				c.Path(), c.Method(), tokenSource, err)
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid or expired token"})
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			log.Printf("[AUTH] Invalid token claims - path: %s, method: %s", c.Path(), c.Method())
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid token claims"})
		}

		// Set user ID and claims in context
		// Assuming user_id is in claims as "user_id"
		if userID, ok := claims["user_id"]; ok {
			c.Locals("user_id", userID)
		} else {
			log.Printf("[AUTH] Token missing user_id - path: %s, method: %s", c.Path(), c.Method())
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Token missing user_id"})
		}

		// Keep raw claims if needed
		c.Locals("claims", claims)

		// Log successful authentication (useful for debugging)
		// log.Printf("[AUTH] Success - path: %s, method: %s, source: %s, user_id: %v",
		// 	c.Path(), c.Method(), tokenSource, userID)

		return c.Next()
	}
}
