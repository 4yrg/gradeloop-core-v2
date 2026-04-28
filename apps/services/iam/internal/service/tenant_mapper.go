package service

import (
	"context"
	"errors"
	"strings"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/config"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/domain"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/repository"
)

var (
	ErrTenantMapperNotFound = errors.New("tenant not found")
)

// TenantMapper resolves tenant from SSO identity
type TenantMapper struct {
	tenantRepo repository.TenantRepository
	ssoConfig *config.SSOConfig
}

// NewTenantMapper creates a new tenant mapper
func NewTenantMapper(
	tenantRepo repository.TenantRepository,
	ssoConfig *config.SSOConfig,
) *TenantMapper {
	return &TenantMapper{
		tenantRepo: tenantRepo,
		ssoConfig: ssoConfig,
	}
}

// ResolveTenant determines tenant from SSO identity
func (m *TenantMapper) ResolveTenant(ctx context.Context, identity *domain.SSOIdentity) (string, error) {
	// 1. If tenant already in identity, use it
	if identity.TenantID != "" {
		return identity.TenantID, nil
	}

	// 2. Extract from email domain
	if identity.Email != "" {
		domain := extractEmailDomain(identity.Email)
		if domain != "" {
			tenant, err := m.tenantRepo.GetByDomain(ctx, domain)
			if err == nil && tenant != nil && tenant.IsActive {
				return tenant.ID.String(), nil
			}
		}
	}

	// 3. Provider-specific mapping (Google Workspace, etc.)
	tenantID, err := m.resolveFromProvider(ctx, identity)
	if err == nil && tenantID != "" {
		return tenantID, nil
	}

	// 4. Default fallback for local mode
	if m.ssoConfig.IsMockMode() {
		tenant, err := m.tenantRepo.GetDefault(ctx)
		if err == nil && tenant != nil {
			return tenant.ID.String(), nil
		}
		// Return dev-university as fallback
		return "dev-university", nil
	}

	// Production: require explicit tenant
	if m.ssoConfig.IsRealMode() {
		return "", ErrTenantMapperNotFound
	}

	return "", ErrTenantMapperNotFound
}

// resolveFromProvider handles provider-specific tenant resolution
func (m *TenantMapper) resolveFromProvider(ctx context.Context, identity *domain.SSOIdentity) (string, error) {
	switch identity.Provider {
	case "google":
		// Google Workspace domain can be used for tenant lookup
		// Extract domain from email
		domain := extractEmailDomain(identity.Email)
		if domain != "" {
			tenant, err := m.tenantRepo.GetByDomain(ctx, domain)
			if err == nil && tenant != nil {
				return tenant.ID.String(), nil
			}
		}

	case "microsoft":
		// Similar to Google - use email domain
		domain := extractEmailDomain(identity.Email)
		if domain != "" {
			tenant, err := m.tenantRepo.GetByDomain(ctx, domain)
			if err == nil && tenant != nil {
				return tenant.ID.String(), nil
			}
		}

	case "saml":
		// SAML might have tenant_id in attributes
		if identity.TenantID != "" {
			return identity.TenantID, nil
		}

	case "keycloak":
		// Keycloak local users
		// Already have tenant in JWT claims

	case "mock":
		// Mock users always get dev tenant
		return "dev-university", nil
	}

	return "", ErrTenantMapperNotFound
}

// extractEmailDomain extracts domain from email address
func extractEmailDomain(email string) string {
	parts := strings.Split(email, "@")
	if len(parts) != 2 {
		return ""
	}
	return strings.ToLower(parts[1])
}

// GetTenantBySlug gets tenant by slug (for subdomain resolution)
func (m *TenantMapper) GetTenantBySlug(ctx context.Context, slug string) (*domain.Tenant, error) {
	row, err := m.tenantRepo.GetBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}
	return rowToDomain(row), nil
}

// GetTenantByDomain gets tenant by domain
func (m *TenantMapper) GetTenantByDomain(ctx context.Context, domain string) (*domain.Tenant, error) {
	row, err := m.tenantRepo.GetByDomain(ctx, domain)
	if err != nil {
		return nil, err
	}
	return rowToDomain(row), nil
}

// rowToDomain converts repository.TenantRow to domain.Tenant
func rowToDomain(row *repository.TenantRow) *domain.Tenant {
	return &domain.Tenant{
		ID:         row.ID,
		Name:       row.Name,
		Slug:       row.Slug,
		Domain:     row.Domain,
		KeycloakID: row.KeycloakID,
		IsActive:   row.IsActive,
		Settings:  row.Settings,
	}
}
