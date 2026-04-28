package middleware

import (
	"fmt"
	"strings"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/config"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/repository"
	"github.com/gofiber/fiber/v3"
)

// TenantResolver resolves tenant_id from requests
// Priority: JWT claim → Header override → Subdomain → Default
type TenantResolver struct {
	repo      repository.TenantRepository
	appConfig *config.AppConfig
}

// NewTenantResolver creates a new tenant resolver
func NewTenantResolver(repo repository.TenantRepository, appConfig *config.AppConfig) *TenantResolver {
	return &TenantResolver{
		repo:      repo,
		appConfig: appConfig,
	}
}

// Resolve resolves the tenant ID from the request
// Returns error if tenant cannot be resolved in production mode
func (t *TenantResolver) Resolve(c fiber.Ctx, claims *KeycloakClaims) (string, error) {
	env := t.appConfig.Environment

	// 1. Try: JWT claim (primary - works in both envs)
	if claims.TenantID != "" {
		return claims.TenantID, nil
	}

	// 2. Try: Header override (local only)
	if env == "local" {
		headerTenantID := c.Get("X-Tenant-ID")
		if headerTenantID != "" {
			return headerTenantID, nil
		}
	}

	// 3. Try: Subdomain lookup (production only)
	if env == "production" {
		host := c.Hostname()
		subdomain, found := extractSubdomain(host, "gradeloop.space")
		if found {
			tenant, err := t.repo.GetBySlug(c.RequestCtx(), subdomain)
			if err == nil && tenant != nil && tenant.IsActive {
				return tenant.ID.String(), nil
			}
		}
	}

	// 4. Try: Default tenant (local only)
	if env == "local" {
		defaultTenant, err := t.repo.GetDefault(c.RequestCtx())
		if err == nil && defaultTenant != nil {
			return defaultTenant.ID.String(), nil
		}
	}

	// Production: tenant is required
	if env == "production" {
		return "", fmt.Errorf("tenant not resolved: no tenant_id in token, no valid subdomain")
	}

	// Local fallback (shouldn't reach here)
	return "dev-university", nil
}

// ResolveFromSubdomain resolves tenant from subdomain
func (t *TenantResolver) ResolveFromSubdomain(host string) (string, error) {
	subdomain, found := extractSubdomain(host, "gradeloop.space")
	if !found {
		return "", fmt.Errorf("no subdomain found in host: %s", host)
	}

	tenant, err := t.repo.GetBySlug(nil, subdomain)
	if err != nil {
		return "", fmt.Errorf("tenant not found: %s", subdomain)
	}

	if !tenant.IsActive {
		return "", fmt.Errorf("tenant is inactive: %s", subdomain)
	}

	return tenant.ID.String(), nil
}

// ResolveFromHeader resolves tenant from header (local only)
func (t *TenantResolver) ResolveFromHeader(header string) (string, error) {
	if t.appConfig.Environment != "local" {
		return "", fmt.Errorf("header tenant override not allowed in production")
	}

	if header == "" {
		return "", fmt.Errorf("empty X-Tenant-ID header")
	}

	// Validate tenant exists
	tenant, err := t.repo.GetBySlug(nil, header)
	if err != nil {
		return "", fmt.Errorf("invalid tenant: %s", header)
	}

	if !tenant.IsActive {
		return "", fmt.Errorf("tenant is inactive: %s", header)
	}

	return tenant.ID.String(), nil
}

// ResolveFromJWT resolves tenant from JWT claims
func (t *TenantResolver) ResolveFromJWT(claims *KeycloakClaims) (string, error) {
	if claims.TenantID == "" {
		return "", fmt.Errorf("no tenant_id in token claims")
	}

	return claims.TenantID, nil
}

// ResolveDefaultTenant returns the default tenant ID for local mode
func (t *TenantResolver) ResolveDefaultTenant() (string, error) {
	if t.appConfig.Environment != "local" {
		return "", fmt.Errorf("default tenant only available in local mode")
	}

	tenant, err := t.repo.GetDefault(nil)
	if err != nil {
		return "", fmt.Errorf("failed to get default tenant: %w", err)
	}

	return tenant.ID.String(), nil
}

// extractSubdomain extracts subdomain from host
func extractSubdomain(host, domain string) (string, bool) {
	// Handle: "stanford.gradeloop.space" -> "stanford"
	// Handle: "stanford.localhost" -> "stanford" (local dev)
	// Handle: "localhost" -> "" (no subdomain)
	
	if host == domain || host == "www."+domain {
		return "", false
	}

	// Remove port if present
	if idx := strings.Index(host, ":"); idx != -1 {
		host = host[:idx]
	}

	// Try gradeloop.space suffix
	suffix := "." + domain
	if idx := strings.Index(host, suffix); idx > 0 {
		return host[:idx], true
	}

	// Try localhost suffix (local dev)
	localSuffix := ".localhost"
	if idx := strings.Index(host, localSuffix); idx > 0 {
		return host[:idx], true
	}

	// No subdomain found
	return "", false
}

// TenantMiddleware creates middleware that resolves and enforces tenant
func TenantMiddleware(resolver *TenantResolver) fiber.Handler {
	return func(c fiber.Ctx) error {
		// Get claims from context (set by auth middleware)
		claimsVal := c.Locals("keycloak_claims")
		if claimsVal == nil {
			// Try legacy claims
			claimsVal = c.Locals("claims")
		}

		var claims *KeycloakClaims
		if c, ok := claimsVal.(*KeycloakClaims); ok {
			claims = c
		}

		// Resolve tenant
		tenantID, err := resolver.Resolve(c, claims)
		if err != nil {
			// Local mode: allow request with default tenant
			if resolver.appConfig.Environment == "local" {
				c.Locals("tenant_id", "dev-university")
				return c.Next()
			}
			return fiber.NewError(fiber.StatusForbidden, "Tenant not resolved")
		}

		// Store tenant in context
		c.Locals("tenant_id", tenantID)

		return c.Next()
	}
}

// ExtractTenantID extracts tenant_id from context
func ExtractTenantID(c fiber.Ctx) (string, bool) {
	tenantID, ok := c.Locals("tenant_id").(string)
	return tenantID, ok
}