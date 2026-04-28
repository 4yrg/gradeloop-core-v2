package service

import (
	"context"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/repository"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type TenantService interface {
	CreateTenant(ctx context.Context, name, slug, domain, settings string) (*repository.TenantRow, error)
	GetTenant(ctx context.Context, id uuid.UUID) (*repository.TenantRow, error)
	UpdateTenant(ctx context.Context, id uuid.UUID, name, domain string, isActive *bool, settings string) (*repository.TenantRow, error)
	DeleteTenant(ctx context.Context, id uuid.UUID) error
	ListTenants(ctx context.Context, page, limit int, search string) ([]*repository.TenantRow, int64, error)
	GetTenantStats(ctx context.Context, tenantID uuid.UUID) (map[string]interface{}, error)
	ResolveByDomain(ctx context.Context, domain string) (*repository.TenantRow, error)
}

type tenantService struct {
	db   *gorm.DB
	repo repository.TenantRepository
}

// NewTenantService creates a new tenant service
func NewTenantService(db *gorm.DB, tenantRepo repository.TenantRepository) TenantService {
	return &tenantService{
		db:   db,
		repo: tenantRepo,
	}
}

func (s *tenantService) CreateTenant(ctx context.Context, name, slug, domain, settings string) (*repository.TenantRow, error) {
	if slug == "" {
		return nil, newError("invalid tenant slug")
	}

	existing, err := s.repo.GetBySlug(ctx, slug)
	if err == nil && existing != nil {
		return nil, newError("tenant already exists")
	}

	tenant := &repository.TenantRow{
		ID:       uuid.New(),
		Name:     name,
		Slug:     slug,
		Domain:   domain,
		IsActive: true,
		Settings: settings,
	}

	if err := s.repo.Create(ctx, tenant); err != nil {
		return nil, err
	}

	return tenant, nil
}

func (s *tenantService) GetTenant(ctx context.Context, id uuid.UUID) (*repository.TenantRow, error) {
	tenant, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, newError("tenant not found")
	}
	return tenant, nil
}

func (s *tenantService) UpdateTenant(ctx context.Context, id uuid.UUID, name, domain string, isActive *bool, settings string) (*repository.TenantRow, error) {
	tenant, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, newError("tenant not found")
	}

	if name != "" {
		tenant.Name = name
	}
	if domain != "" {
		tenant.Domain = domain
	}
	if isActive != nil {
		tenant.IsActive = *isActive
	}
	if settings != "" {
		tenant.Settings = settings
	}

	if err := s.repo.Update(ctx, tenant); err != nil {
		return nil, err
	}

	return tenant, nil
}

func (s *tenantService) DeleteTenant(ctx context.Context, id uuid.UUID) error {
	return s.repo.Delete(ctx, id)
}

func (s *tenantService) ListTenants(ctx context.Context, page, limit int, search string) ([]*repository.TenantRow, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}

	return s.repo.List(ctx, (page-1)*limit, limit)
}

func (s *tenantService) GetTenantStats(ctx context.Context, tenantID uuid.UUID) (map[string]interface{}, error) {
	return map[string]interface{}{
		"tenant_id": tenantID.String(),
		"users":     0,
		"courses":   0,
	}, nil
}

func (s *tenantService) ResolveByDomain(ctx context.Context, domain string) (*repository.TenantRow, error) {
	tenant, err := s.repo.GetByDomain(ctx, domain)
	if err != nil {
		return nil, newError("tenant not found")
	}
	return tenant, nil
}

func newError(msg string) error {
	return &serviceError{msg: msg}
}

type serviceError struct {
	msg string
}

func (e *serviceError) Error() string {
	return e.msg
}
