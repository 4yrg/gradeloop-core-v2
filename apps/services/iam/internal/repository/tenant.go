package repository

import (
	"context"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// TenantRow represents a tenant row from database
type TenantRow struct {
	ID         uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	Name       string   `gorm:"size:255;not null" json:"name"`
	Slug       string   `gorm:"uniqueIndex;size:50;not null" json:"slug"`
	Domain     string   `gorm:"size:255" json:"domain"`
	KeycloakID string   `gorm:"size:255" json:"keycloak_id"`
	IsActive   bool     `gorm:"default:true" json:"is_active"`
	Settings  string   `gorm:"type:text" json:"settings"`
}

// TableName specifies the table name
func (TenantRow) TableName() string {
	return "tenants"
}

// TenantRepository defines operations for tenant data
type TenantRepository interface {
	Create(ctx context.Context, tenant *TenantRow) error
	GetByID(ctx context.Context, id uuid.UUID) (*TenantRow, error)
	GetBySlug(ctx context.Context, slug string) (*TenantRow, error)
	GetByDomain(ctx context.Context, domain string) (*TenantRow, error)
	GetByKeycloakID(ctx context.Context, keycloakID string) (*TenantRow, error)
	Update(ctx context.Context, tenant *TenantRow) error
	Delete(ctx context.Context, id uuid.UUID) error
	List(ctx context.Context, offset, limit int) ([]*TenantRow, int64, error)
	GetDefault(ctx context.Context) (*TenantRow, error)
}

type tenantRepository struct {
	db *gorm.DB
}

// NewTenantRepository creates a new tenant repository
func NewTenantRepository(db *gorm.DB) TenantRepository {
	return &tenantRepository{db: db}
}

func (r *tenantRepository) Create(ctx context.Context, tenant *TenantRow) error {
	return r.db.WithContext(ctx).Create(tenant).Error
}

func (r *tenantRepository) GetByID(ctx context.Context, id uuid.UUID) (*TenantRow, error) {
	var tenant TenantRow
	err := r.db.WithContext(ctx).
		Where("id = ?", id).
		First(&tenant).Error
	if err != nil {
		return nil, err
	}
	return &tenant, nil
}

func (r *tenantRepository) GetBySlug(ctx context.Context, slug string) (*TenantRow, error) {
	var tenant TenantRow
	err := r.db.WithContext(ctx).
		Where("slug = ?", slug).
		First(&tenant).Error
	if err != nil {
		return nil, err
	}
	return &tenant, nil
}

func (r *tenantRepository) GetByDomain(ctx context.Context, domain string) (*TenantRow, error) {
	var tenant TenantRow
	err := r.db.WithContext(ctx).
		Where("domain = ?", domain).
		First(&tenant).Error
	if err != nil {
		return nil, err
	}
	return &tenant, nil
}

func (r *tenantRepository) GetByKeycloakID(ctx context.Context, keycloakID string) (*TenantRow, error) {
	var tenant TenantRow
	err := r.db.WithContext(ctx).
		Where("keycloak_id = ?", keycloakID).
		First(&tenant).Error
	if err != nil {
		return nil, err
	}
	return &tenant, nil
}

func (r *tenantRepository) Update(ctx context.Context, tenant *TenantRow) error {
	return r.db.WithContext(ctx).Save(tenant).Error
}

func (r *tenantRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).
		Model(&TenantRow{}).
		Where("id = ?", id).
		Update("deleted_at", gorm.Expr("NOW()")).Error
}

func (r *tenantRepository) List(ctx context.Context, offset, limit int) ([]*TenantRow, int64, error) {
	var tenants []*TenantRow
	var total int64

	query := r.db.WithContext(ctx).Model(&TenantRow{})

	err := query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}

	err = query.
		Offset(offset).
		Limit(limit).
		Order("created_at DESC").
		Find(&tenants).Error

	return tenants, total, err
}

func (r *tenantRepository) GetDefault(ctx context.Context) (*TenantRow, error) {
	var tenant TenantRow
	err := r.db.WithContext(ctx).
		Where("slug = ?", "dev-university").
		First(&tenant).Error

	if err == gorm.ErrRecordNotFound {
		defaultTenant := &TenantRow{
			ID:        uuid.MustParse("00000000-0000-0000-0000-000000000001"),
			Name:      "Development Tenant",
			Slug:      "dev-university",
			Domain:    "localhost",
			KeycloakID: "gradeloop-lms",
			IsActive:  true,
		}
		err = r.db.WithContext(ctx).Create(defaultTenant).Error
		if err != nil {
			return nil, err
		}
		return defaultTenant, nil
	}

	if err != nil {
		return nil, err
	}

	return &tenant, nil
}