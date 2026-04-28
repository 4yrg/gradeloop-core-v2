package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/dto"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/repository"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

var (
	ErrTenantNotFound = errors.New("tenant not found")
	ErrTenantExists   = errors.New("tenant already exists")
	ErrInvalidSlug    = errors.New("invalid tenant slug")
)

type TenantService interface {
	CreateTenant(ctx context.Context, req *dto.CreateTenantRequest) (*dto.TenantResponse, error)
	GetTenant(ctx context.Context, tenantID string) (*dto.TenantResponse, error)
	GetTenantBySlug(ctx context.Context, slug string) (*dto.TenantResponse, error)
	ListTenants(ctx context.Context, page, limit int, search string) (*dto.TenantListResponse, error)
	UpdateTenant(ctx context.Context, tenantID string, req *dto.UpdateTenantRequest) (*dto.TenantResponse, error)
	DeleteTenant(ctx context.Context, tenantID string) error
	GetTenantStats(ctx context.Context, tenantID string) (*dto.TenantStatsResponse, error)
	ResolveTenantByDomain(ctx context.Context, domain string) (*dto.TenantResponse, error)
	GetDefaultTenant(ctx context.Context) (*dto.TenantResponse, error)
}

type tenantService struct {
	tenantRepo repository.TenantRepository
	userRepo   repository.UserRepository
}

func NewTenantService(tenantRepo repository.TenantRepository, userRepo repository.UserRepository) TenantService {
	return &tenantService{
		tenantRepo: tenantRepo,
		userRepo:   userRepo,
	}
}

func (s *tenantService) CreateTenant(ctx context.Context, req *dto.CreateTenantRequest) (*dto.TenantResponse, error) {
	existing, err := s.tenantRepo.GetBySlug(ctx, req.Slug)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("checking existing tenant: %w", err)
	}
	if existing != nil {
		return nil, ErrTenantExists
	}

	tenant := &repository.TenantRow{
		ID:        uuid.New(),
		Name:      req.Name,
		Slug:      req.Slug,
		Domain:    req.Domain,
		IsActive:  true,
		Settings:  req.Settings,
	}

	if err := s.tenantRepo.Create(ctx, tenant); err != nil {
		return nil, fmt.Errorf("creating tenant: %w", err)
	}

	return s.toResponse(tenant), nil
}

func (s *tenantService) GetTenant(ctx context.Context, tenantID string) (*dto.TenantResponse, error) {
	id, err := uuid.Parse(tenantID)
	if err != nil {
		return nil, fmt.Errorf("invalid tenant ID: %w", err)
	}

	tenant, err := s.tenantRepo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrTenantNotFound
		}
		return nil, fmt.Errorf("fetching tenant: %w", err)
	}

	return s.toResponse(tenant), nil
}

func (s *tenantService) GetTenantBySlug(ctx context.Context, slug string) (*dto.TenantResponse, error) {
	tenant, err := s.tenantRepo.GetBySlug(ctx, slug)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrTenantNotFound
		}
		return nil, fmt.Errorf("fetching tenant: %w", err)
	}

	return s.toResponse(tenant), nil
}

func (s *tenantService) ListTenants(ctx context.Context, page, limit int, search string) (*dto.TenantListResponse, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 10
	}
	if limit > 100 {
		limit = 100
	}

	offset := (page - 1) * limit

	var tenants []*repository.TenantRow
	var total int64
	var err error

	if search != "" {
		tenants, total, err = s.tenantRepo.Search(ctx, search, offset, limit)
	} else {
		tenants, total, err = s.tenantRepo.List(ctx, offset, limit)
	}

	if err != nil {
		return nil, fmt.Errorf("fetching tenants: %w", err)
	}

	tenantResponses := make([]dto.TenantResponse, 0, len(tenants))
	for _, t := range tenants {
		tenantResponses = append(tenantResponses, *s.toResponse(t))
	}

	return &dto.TenantListResponse{
		Tenants:    tenantResponses,
		TotalCount: total,
		Page:       page,
		Limit:      limit,
	}, nil
}

func (s *tenantService) UpdateTenant(ctx context.Context, tenantID string, req *dto.UpdateTenantRequest) (*dto.TenantResponse, error) {
	id, err := uuid.Parse(tenantID)
	if err != nil {
		return nil, fmt.Errorf("invalid tenant ID: %w", err)
	}

	tenant, err := s.tenantRepo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrTenantNotFound
		}
		return nil, fmt.Errorf("fetching tenant: %w", err)
	}

	if req.Name != nil {
		tenant.Name = *req.Name
	}
	if req.Domain != nil {
		tenant.Domain = *req.Domain
	}
	if req.IsActive != nil {
		tenant.IsActive = *req.IsActive
	}
	if req.Settings != nil {
		tenant.Settings = *req.Settings
	}

	if err := s.tenantRepo.Update(ctx, tenant); err != nil {
		return nil, fmt.Errorf("updating tenant: %w", err)
	}

	return s.toResponse(tenant), nil
}

func (s *tenantService) DeleteTenant(ctx context.Context, tenantID string) error {
	id, err := uuid.Parse(tenantID)
	if err != nil {
		return fmt.Errorf("invalid tenant ID: %w", err)
	}

	tenant, err := s.tenantRepo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrTenantNotFound
		}
		return fmt.Errorf("fetching tenant: %w", err)
	}

	if tenant.Slug == "dev-university" || tenant.Slug == "default" {
		return errors.New("cannot delete default tenant")
	}

	return s.tenantRepo.Delete(ctx, id)
}

func (s *tenantService) GetTenantStats(ctx context.Context, tenantID string) (*dto.TenantStatsResponse, error) {
	id, err := uuid.Parse(tenantID)
	if err != nil {
		return nil, fmt.Errorf("invalid tenant ID: %w", err)
	}

	stats, err := s.userRepo.GetTenantUserStats(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("fetching tenant stats: %w", err)
	}

	return stats, nil
}

func (s *tenantService) ResolveTenantByDomain(ctx context.Context, domain string) (*dto.TenantResponse, error) {
	if domain == "" {
		return s.GetDefaultTenant(ctx)
	}

	tenant, err := s.tenantRepo.GetByDomain(ctx, domain)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return s.GetDefaultTenant(ctx)
		}
		return nil, fmt.Errorf("resolving tenant by domain: %w", err)
	}

	if !tenant.IsActive {
		return nil, errors.New("tenant is not active")
	}

	return s.toResponse(tenant), nil
}

func (s *tenantService) GetDefaultTenant(ctx context.Context) (*dto.TenantResponse, error) {
	tenant, err := s.tenantRepo.GetDefault(ctx)
	if err != nil {
		return nil, fmt.Errorf("fetching default tenant: %w", err)
	}

	return s.toResponse(tenant), nil
}

func (s *tenantService) toResponse(tenant *repository.TenantRow) *dto.TenantResponse {
	return &dto.TenantResponse{
		ID:        tenant.ID,
		Name:      tenant.Name,
		Slug:      tenant.Slug,
		Domain:    tenant.Domain,
		IsActive:  tenant.IsActive,
		Settings:  tenant.Settings,
		CreatedAt: tenant.CreatedAt,
		UpdatedAt: tenant.UpdatedAt,
	}
}