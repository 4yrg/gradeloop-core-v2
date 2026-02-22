package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gradeloop/academic-service/internal/utils"
)

type Claims struct {
	UserID      uint     `json:"user_id"`
	Email       string   `json:"email"`
	Roles       []string `json:"roles"`
	Permissions []string `json:"permissions"`
	jwt.RegisteredClaims
}

func AuthMiddleware(secretKey []byte) fiber.Handler {
	return func(c fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return utils.ErrUnauthorized("Missing authorization header")
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			return utils.ErrUnauthorized("Invalid authorization header format")
		}

		tokenString := parts[1]

		token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, utils.ErrUnauthorized("Invalid signing method")
			}
			return secretKey, nil
		})

		if err != nil {
			return utils.ErrUnauthorized("Invalid token")
		}

		claims, ok := token.Claims.(*Claims)
		if !ok || !token.Valid {
			return utils.ErrUnauthorized("Invalid token claims")
		}

		c.Locals("user_id", claims.UserID)
		c.Locals("email", claims.Email)
		c.Locals("roles", claims.Roles)
		c.Locals("permissions", claims.Permissions)

		return c.Next()
	}
}

func RequirePermission(permission string) fiber.Handler {
	return func(c fiber.Ctx) error {
		permissions, ok := c.Locals("permissions").([]string)
		if !ok {
			return utils.ErrForbidden("No permissions found")
		}

		for _, p := range permissions {
			if p == permission {
				return c.Next()
			}
		}

		return utils.ErrForbidden("Insufficient permissions")
	}
}

func RequireRole(role string) fiber.Handler {
	return func(c fiber.Ctx) error {
		roles, ok := c.Locals("roles").([]string)
		if !ok {
			return utils.ErrForbidden("No roles found")
		}

		for _, r := range roles {
			if r == role {
				return c.Next()
			}
		}

		return utils.ErrForbidden("Insufficient role")
	}
}
