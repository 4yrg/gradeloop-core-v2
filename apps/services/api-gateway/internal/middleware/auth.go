package middleware

import (
	"errors"
	"log/slog"
	"strings"

	"github.com/4yrg/gradeloop-core-v2/apps/services/api-gateway/internal/config"
	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
)

func JWTMiddleware(secret string) fiber.Handler {
	return func(c fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error":   "unauthorized",
				"message": "missing authorization header",
			})
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[Part0] != "Bearer" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error":   "unauthorized",
				"message": "invalid authorization header format",
			})
		}

		tokenStr := parts[Part1]
		claims := &config.AccessTokenClaims{}

		token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, errors.New("unexpected signing method")
			}
			return []byte(secret), nil
		})

		if err != nil {
			status := fiber.StatusUnauthorized
			msg := "invalid or expired token"
			if errors.Is(err, jwt.ErrTokenExpired) {
				msg = "token has expired"
			}
			return c.Status(status).JSON(fiber.Map{
				"error":   "unauthorized",
				"message": msg,
			})
		}

		if !token.Valid {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error":   "unauthorized",
				"message": "invalid token",
			})
		}

		c.Locals("user", claims)
		return c.Next()
	}
}

func HasPermission(requiredPermission string, logger *slog.Logger) fiber.Handler {
	return func(c fiber.Ctx) error {
		claims, ok := c.Locals("user").(*config.AccessTokenClaims)
		if !ok {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}

		// Check permissions
		hasPermission := false
		for _, p := range claims.Permissions {
			if p == requiredPermission {
				hasPermission = true
				break
			}
		}

		if !hasPermission {
			logger.Error("access denied",
				"user_id", claims.Subject,
				"requested_route", c.Method()+" "+c.Path(),
				"required_permission", requiredPermission,
				"result", "denied",
			)
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "insufficient_permissions"})
		}

		logger.Info("access allowed",
			"user_id", claims.Subject,
			"requested_route", c.Method()+" "+c.Path(),
			"required_permission", requiredPermission,
			"result", "allowed",
		)

		return c.Next()
	}
}

func ProxyHandler(target string) fiber.Handler {
	return func(c fiber.Ctx) error {
		// In a real scenario, use fiber's proxy middleware or a custom reverse proxy
		// For this task, we can use fiber/middleware/proxy.
		// Since I'm writing the main.go soon, I'll use it there.
		return c.Next()
	}
}

const (
	Part0 = 0
	Part1 = 1
)
