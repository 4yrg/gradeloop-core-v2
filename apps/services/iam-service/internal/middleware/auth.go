package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
	"github.com/rs/zerolog/log"
)

// AuthMiddleware creates a JWT authentication middleware
func AuthMiddleware(secret string) fiber.Handler {
	return func(c fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Authorization header missing",
			})
		}

		if !strings.HasPrefix(authHeader, "Bearer ") {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Invalid authorization header format",
			})
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")

		// Parse and validate the token
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			return []byte(secret), nil
		}, jwt.WithValidMethods([]string{"HS256"}))

		if err != nil || !token.Valid {
			log.Warn().Err(err).Str("path", c.Path()).Msg("JWT authentication failed")
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Invalid or expired token",
			})
		}

		// Store the token in the context for later use
		c.Locals("user", token)

		return c.Next()
	}
}

// ExtractUserID extracts the user ID from the JWT token
func ExtractUserID(c fiber.Ctx) (string, error) {
	token := c.Locals("user").(*jwt.Token)
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "", fiber.NewError(fiber.StatusBadRequest, "invalid token claims")
	}

	subject, err := claims.GetSubject()
	if err != nil {
		return "", fiber.NewError(fiber.StatusBadRequest, "invalid subject in token")
	}

	return subject, nil
}

// HasRole checks if the authenticated user has a specific role
func HasRole(requiredRole string) fiber.Handler {
	return func(c fiber.Ctx) error {
		token := c.Locals("user").(*jwt.Token)
		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "Invalid token claims",
			})
		}

		rolesClaim := claims["roles"]
		if rolesClaim == nil {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "Insufficient permissions",
			})
		}

		roles, ok := rolesClaim.([]interface{})
		if !ok {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "Invalid roles format",
			})
		}

		for _, role := range roles {
			if roleStr, ok := role.(string); ok && roleStr == requiredRole {
				return c.Next()
			}
		}

		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Insufficient permissions",
		})
	}
}

// HasPermission checks if the authenticated user has a specific permission
func HasPermission(requiredPermission string) fiber.Handler {
	return func(c fiber.Ctx) error {
		// In a real system, you would check permissions from the claims
		// For now, we'll just allow all permissions for demonstration

		return c.Next()
	}
}

// IsAuthenticated checks if the user is authenticated
func IsAuthenticated(c fiber.Ctx) error {
	authHeader := c.Get("Authorization")
	if authHeader == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Authorization header missing",
		})
	}

	if !strings.HasPrefix(authHeader, "Bearer ") {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Invalid authorization header format",
		})
	}

	// If we reach this point, the token should be validated by the AuthMiddleware
	return nil
}
