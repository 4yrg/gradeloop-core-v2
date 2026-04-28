package middleware

import (
	"strings"

	"github.com/4yrg/gradeloop-core-v2/apps/services/notification/internal/utils"
	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID   string `json:"user_id"`
	Email    string `json:"email"`
	UserType string `json:"user_type"`
	jwt.RegisteredClaims
}

func AuthMiddleware(secretKey []byte) fiber.Handler {
	return func(c fiber.Ctx) error {
		tokenString := ""

		authHeader := c.Get("Authorization")
		if authHeader != "" {
			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) == 2 && parts[0] == "Bearer" {
				tokenString = parts[1]
			}
		}

		if tokenString == "" {
			tokenString = c.Query("token")
		}

		if tokenString == "" {
			return utils.ErrUnauthorized("missing authorization header or token")
		}

		token, err := jwt.ParseWithClaims(
			tokenString,
			&Claims{},
			func(token *jwt.Token) (interface{}, error) {
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, utils.ErrUnauthorized("invalid signing method")
				}
				return secretKey, nil
			},
		)
		if err != nil {
			return utils.ErrUnauthorized("invalid token")
		}

		claims, ok := token.Claims.(*Claims)
		if !ok || !token.Valid {
			return utils.ErrUnauthorized("invalid token claims")
		}

		c.Locals("user_id", claims.UserID)
		c.Locals("username", claims.Email)
		c.Locals("user_type", claims.UserType)

		return c.Next()
	}
}

func RequireAnyUserType(userTypes ...string) fiber.Handler {
	return func(c fiber.Ctx) error {
		currentUserType, ok := c.Locals("user_type").(string)
		if !ok || currentUserType == "" {
			return utils.ErrForbidden("no user type found")
		}

		for _, ut := range userTypes {
			if currentUserType == ut {
				return c.Next()
			}
		}

		return utils.ErrForbidden("insufficient privileges")
	}
}
