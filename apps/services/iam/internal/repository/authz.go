package repository

import (
	"context"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/domain"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// PolicyRepository defines operations for policy data
type PolicyRepository interface {
	Create(ctx context.Context, policy *domain.Policy) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.Policy, error)
	GetByTenant(ctx context.Context, tenantID uuid.UUID) ([]*domain.Policy, error)
	GetActive(ctx context.Context, tenantID uuid.UUID) ([]*domain.Policy, error)
	GetByAction(ctx context.Context, action, resource string, tenantID uuid.UUID) ([]*domain.Policy, error)
	Update(ctx context.Context, policy *domain.Policy) error
	Delete(ctx context.Context, id uuid.UUID) error
}

type policyRepository struct {
	db *gorm.DB
}

// NewPolicyRepository creates a new policy repository
func NewPolicyRepository(db *gorm.DB) PolicyRepository {
	return &policyRepository{db: db}
}

func (r *policyRepository) Create(ctx context.Context, policy *domain.Policy) error {
	policy.ID = uuid.New()
	return r.db.WithContext(ctx).Create(policy).Error
}

func (r *policyRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.Policy, error) {
	var policy domain.Policy
	err := r.db.WithContext(ctx).
		Where("id = ?", id).
		First(&policy).Error
	return &policy, err
}

func (r *policyRepository) GetByTenant(ctx context.Context, tenantID uuid.UUID) ([]*domain.Policy, error) {
	var policies []*domain.Policy
	err := r.db.WithContext(ctx).
		Where("tenant_id = ?", tenantID).
		Order("priority DESC").
		Find(&policies).Error
	return policies, err
}

func (r *policyRepository) GetActive(ctx context.Context, tenantID uuid.UUID) ([]*domain.Policy, error) {
	var policies []*domain.Policy
	err := r.db.WithContext(ctx).
		Where("tenant_id = ? AND is_active = ?", tenantID, true).
		Order("priority DESC").
		Find(&policies).Error
	return policies, err
}

func (r *policyRepository) GetByAction(ctx context.Context, action, resource string, tenantID uuid.UUID) ([]*domain.Policy, error) {
	var policies []*domain.Policy
	err := r.db.WithContext(ctx).
		Where("(tenant_id = ? OR tenant_id IS NULL) AND is_active = ?", tenantID, true).
		Where("(action = ? OR action LIKE ?) AND (resource = ? OR resource = ?)",
			action, action+":%",
			resource, "*").
		Order("priority DESC").
		Find(&policies).Error
	return policies, err
}

func (r *policyRepository) Update(ctx context.Context, policy *domain.Policy) error {
	policy.UpdatedAt = time.Now()
	return r.db.WithContext(ctx).Save(policy).Error
}

func (r *policyRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).
		Model(&domain.Policy{}).
		Where("id = ?", id).
		Update("is_active", false).Error
}

// PolicyAuditRepository defines operations for policy audit
type PolicyAuditRepository interface {
	Create(ctx context.Context, audit *domain.PolicyAudit) error
	GetByUser(ctx context.Context, userID uuid.UUID, from time.Time) ([]*domain.PolicyAudit, error)
	GetByTenant(ctx context.Context, tenantID uuid.UUID, from time.Time) ([]*domain.PolicyAudit, error)
	GetByPolicy(ctx context.Context, policyID uuid.UUID) ([]*domain.PolicyAudit, error)
	GetRecent(ctx context.Context, limit int) ([]*domain.PolicyAudit, error)
}

type policyAuditRepository struct {
	db *gorm.DB
}

// NewPolicyAuditRepository creates a new audit repository
func NewPolicyAuditRepository(db *gorm.DB) PolicyAuditRepository {
	return &policyAuditRepository{db: db}
}

func (r *policyAuditRepository) Create(ctx context.Context, audit *domain.PolicyAudit) error {
	audit.ID = uuid.New()
	audit.CreatedAt = time.Now()
	return r.db.WithContext(ctx).Create(audit).Error
}

func (r *policyAuditRepository) GetByUser(ctx context.Context, userID uuid.UUID, from time.Time) ([]*domain.PolicyAudit, error) {
	var audits []*domain.PolicyAudit
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND created_at > ?", userID, from).
		Order("created_at DESC").
		Find(&audits).Error
	return audits, err
}

func (r *policyAuditRepository) GetByTenant(ctx context.Context, tenantID uuid.UUID, from time.Time) ([]*domain.PolicyAudit, error) {
	var audits []*domain.PolicyAudit
	err := r.db.WithContext(ctx).
		Where("tenant_id = ? AND created_at > ?", tenantID, from).
		Order("created_at DESC").
		Find(&audits).Error
	return audits, err
}

func (r *policyAuditRepository) GetByPolicy(ctx context.Context, policyID uuid.UUID) ([]*domain.PolicyAudit, error) {
	var audits []*domain.PolicyAudit
	err := r.db.WithContext(ctx).
		Where("policy_id = ?", policyID).
		Order("created_at DESC").
		Find(&audits).Error
	return audits, err
}

func (r *policyAuditRepository) GetRecent(ctx context.Context, limit int) ([]*domain.PolicyAudit, error) {
	var audits []*domain.PolicyAudit
	err := r.db.WithContext(ctx).
		Order("created_at DESC").
		Limit(limit).
		Find(&audits).Error
	return audits, err
}
