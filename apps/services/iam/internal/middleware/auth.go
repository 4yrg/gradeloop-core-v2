package middleware

import (
	"fmt"
	"strings"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/config"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/middleware/identity"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/middleware/jwks"
	"github.com/gofiber/fiber/v3"
	"github.com/golang-jwt/jwt/v5"
	"github.com/redis/go-redis/v9"
)

// IAMConfig holds all IAM middleware configuration
type IAMConfig struct {
	JWKSProvider *jwks.Provider
	Config      *config.KeycloakConfig
	Redis       *redis.Client
}

// NewIAMMiddleware creates the unified IAM middleware for dual-environment support
func NewIAMMiddleware(cfg *IAMConfig) fiber.Handler {
	return func(c fiber.Ctx) error {
		env := cfg.Config.Environment

		// Store environment in context for debugging
		c.Locals("app_env", env)

		// Skip auth for public endpoints
		if isPublicEndpoint(c.Path(), c.Method()) {
			return c.Next()
		}

		// Extract Authorization header
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return fiber.ErrUnauthorized
		}

		// Parse Bearer token
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			return fiber.ErrUnauthorized
		}

		tokenString := parts[1]

		// Refresh JWKS if needed
		if err := cfg.JWKSProvider.Refresh(c.RequestCtx()); err != nil {
			// In production: fail closed
			if env == "production" {
				fmt.Printf("IAM: JWKS refresh failed in production: %v\n", err)
				return fiber.ErrInternalServerError
			}
			// In local: log but continue
			fmt.Printf("IAM: JWKS refresh failed: %v\n", err)
		}

		// Parse and validate JWT
		claims, err := validateJWTToken(tokenString, cfg.JWKSProvider)
		if err != nil {
			return fiber.ErrUnauthorized
		}

		// Resolve tenant ID
		tenantID := claims.TenantID

		// LOCAL: Allow header override for testing
		if tenantID == "" && env == "local" {
			tenantID = c.Get("X-Tenant-ID")
		}

		// LOCAL: Use default tenant if still missing
		if tenantID == "" && env == "local" {
			tenantID = cfg.Config.DefaultTenant
		}

		// PRODUCTION: Require tenant_id in JWT
		if tenantID == "" && env == "production" {
			return fiber.NewError(fiber.StatusForbidden, "Tenant required")
		}

		// Build identity context
		id := claims.ToIdentity(env)
		id.TenantID = tenantID

		// Store in fiber context for handlers
		c.Locals("identity", id)
		c.Locals("user_id", id.UserID)
		c.Locals("tenant_id", id.TenantID)
		c.Locals("email", id.Email)
		c.Locals("name", id.Name)
		c.Locals("given_name", id.GivenName)
		c.Locals("family_name", id.FamilyName)
		c.Locals("username", id.Username)
		c.Locals("roles", id.Roles)
		c.Locals("permissions", id.Permissions)

		// Backward compatibility: map first role to user_type
		userType := "student"
		if len(id.Roles) > 0 {
			userType = id.Roles[0]
		}
		c.Locals("user_type", userType)

		return c.Next()
	}
}

// validateJWTToken parses and validates a JWT token
func validateJWTToken(tokenString string, jwks *jwks.Provider) (*KeycloakClaims, error) {
	token, err := jwt.ParseWithClaims(
		tokenString,
		&KeycloakClaims{},
		func(t *jwt.Token) (interface{}, error) {
			// Verify signing method is RSA
			if _, ok := t.Method.(*jwt.SigningMethodRSA); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
			}

			// Get key ID from token header
			kid, ok := t.Header["kid"].(string)
			if !ok {
				return nil, fmt.Errorf("missing key ID in token")
			}

			// Get public key from JWKS
			key, err := jwks.GetKey(kid)
			if err != nil {
				return nil, err
			}

			return key, nil
		},
	)

	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}

	claims, ok := token.Claims.(*KeycloakClaims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid claims or token")
	}

	return claims, nil
}

// isPublicEndpoint checks if the endpoint should skip authentication
func isPublicEndpoint(path string, method string) bool {
	// Public endpoints
	publicPaths := []string{
		"/api/v1/auth/login",
		"/api/v1/auth/register",
		"/api/v1/auth/refresh",
		"/api/v1/auth/forgot-password",
		"/api/v1/auth/reset-password",
		"/health",
		"/health/",
		"/api/v1/health",
	}

	// Check exact match
	for _, p := range publicPaths {
		if path == p {
			return true
		}
	}

	// Health check paths
	if strings.HasPrefix(path, "/health") || strings.HasPrefix(path, "/api/v1/health") {
		return true
	}

	return false
}

// RequireRole creates middleware that checks for required role
func RequireRole(roles ...string) fiber.Handler {
	return func(c fiber.Ctx) error {
		id, ok := c.Locals("identity").(*identity.Context)
		if !ok || id == nil {
			return fiber.ErrForbidden
		}

		if !id.HasRole(roles...) {
			return fiber.ErrForbidden
		}

		return c.Next()
	}
}

// RequirePermission creates middleware that checks for required permission
func RequirePermission(perms ...string) fiber.Handler {
	return func(c fiber.Ctx) error {
		id, ok := c.Locals("identity").(*identity.Context)
		if !ok || id == nil {
			return fiber.ErrForbidden
		}

		if !id.HasPermission(perms...) {
			return fiber.ErrForbidden
		}

		return c.Next()
	}
}

// RequireTenant creates middleware that validates tenant access
func RequireTenant(allowedTenants ...string) fiber.Handler {
	return func(c fiber.Ctx) error {
		id, ok := c.Locals("identity").(*identity.Context)
		if !ok || id == nil {
			return fiber.ErrForbidden
		}

		// Local: dev-university has access to everything
		if id.Environment == "local" && id.TenantID == "dev-university" {
			return c.Next()
		}

		// Production: check against allowed list
		for _, t := range allowedTenants {
			if id.TenantID == t {
				return c.Next()
			}
		}

		return fiber.ErrForbidden
	}
}

// RequireAdmin creates middleware that requires admin or super_admin
func RequireAdmin() fiber.Handler {
	return RequireRole("admin", "super_admin")
}

// RequireSuperAdmin creates middleware that requires super_admin
func RequireSuperAdmin() fiber.Handler {
	return RequireRole("super_admin")
}

// RequireInstructor creates middleware that requires instructor, admin or super_admin
func RequireInstructor() fiber.Handler {
	return RequireRole("instructor", "admin", "super_admin")
}

// RequireStudent creates middleware that requires student access
func RequireStudent() fiber.Handler {
	return RequireRole("student")
}

// AuthMiddleware provides backward-compatible JWT validation
// For NEW Keycloak-based auth, use NewIAMMiddleware instead
func AuthMiddleware(secretKey []byte) fiber.Handler {
	return func(c fiber.Ctx) error {
		authHeader := c.Get("Authorization")
		if authHeader == "" {
			return fiber.ErrUnauthorized
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			return fiber.ErrUnauthorized
		}

		// Use legacy JWT validation
		claims, err := validateLegacyToken(parts[1], secretKey)
		if err != nil {
			return fiber.ErrUnauthorized
		}

		c.Locals("user_id", claims.UserID)
		c.Locals("email", claims.Email)
		c.Locals("user_type", claims.UserType)
		c.Locals("full_name", claims.FullName)
		c.Locals("tenant_id", "legacy") // Default tenant for legacy auth

		return c.Next()
	}
}

// LegacyClaims represents claims from legacy JWT (for backward compatibility)
type LegacyClaims struct {
	UserID   string `json:"user_id"`
	Email    string `json:"email"`
	UserType string `json:"user_type"`
	FullName string `json:"full_name"`
	RoleName string `json:"role_name"`
	Permissions []string `json:"permissions"`
	jwt.RegisteredClaims
}

func validateLegacyToken(tokenString string, secretKey []byte) (*LegacyClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &LegacyClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return secretKey, nil
	})

	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*LegacyClaims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	return claims, nil
}

// ExtractIdentity extracts identity from context
func ExtractIdentity(c fiber.Ctx) *identity.Context {
	id, ok := c.Locals("identity").(*identity.Context)
	if !ok {
		return nil
	}
	return id
}

// ExtractTenant extracts tenant_id from context
func ExtractTenant(c fiber.Ctx) (string, error) {
	tenantID, ok := c.Locals("tenant_id").(string)
	if !ok || tenantID == "" {
		return "", fmt.Errorf("tenant not found in context")
	}
	return tenantID, nil
}

// ExtractUserID extracts user_id from context
func ExtractUserID(c fiber.Ctx) (string, error) {
	userID, ok := c.Locals("user_id").(string)
	if !ok || userID == "" {
		return "", fmt.Errorf("user not found in context")
	}
	return userID, nil
}