package repository

import (
	"context"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/domain"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// LTIToolRepository defines operations for LTI tool data
type LTIToolRepository interface {
	CreateTool(ctx context.Context, tool *domain.LTITool) error
	GetToolByID(ctx context.Context, id uuid.UUID) (*domain.LTITool, error)
	GetToolByClientID(ctx context.Context, clientID string) (*domain.LTITool, error)
	GetToolsByTenant(ctx context.Context, tenantID uuid.UUID) ([]*domain.LTITool, error)
	UpdateTool(ctx context.Context, tool *domain.LTITool) error
	DeleteTool(ctx context.Context, id uuid.UUID) error
}

type ltiToolRepository struct {
	db *gorm.DB
}

// NewLTIToolRepository creates a new LTI tool repository
func NewLTIToolRepository(db *gorm.DB) LTIToolRepository {
	return &ltiToolRepository{db: db}
}

func (r *ltiToolRepository) CreateTool(ctx context.Context, tool *domain.LTITool) error {
	tool.ID = uuid.New()
	return r.db.WithContext(ctx).Create(tool).Error
}

func (r *ltiToolRepository) GetToolByID(ctx context.Context, id uuid.UUID) (*domain.LTITool, error) {
	var tool domain.LTITool
	err := r.db.WithContext(ctx).
		Where("id = ?", id).
		First(&tool).Error
	if err != nil {
		return nil, err
	}
	return &tool, nil
}

func (r *ltiToolRepository) GetToolByClientID(ctx context.Context, clientID string) (*domain.LTITool, error) {
	var tool domain.LTITool
	err := r.db.WithContext(ctx).
		Where("client_id = ?", clientID).
		First(&tool).Error
	if err != nil {
		return nil, err
	}
	return &tool, nil
}

func (r *ltiToolRepository) GetToolsByTenant(ctx context.Context, tenantID uuid.UUID) ([]*domain.LTITool, error) {
	var tools []*domain.LTITool
	err := r.db.WithContext(ctx).
		Where("tenant_id = ? AND is_active = ?", tenantID, true).
		Find(&tools).Error
	return tools, err
}

func (r *ltiToolRepository) UpdateTool(ctx context.Context, tool *domain.LTITool) error {
	return r.db.WithContext(ctx).Save(tool).Error
}

func (r *ltiToolRepository) DeleteTool(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).
		Model(&domain.LTITool{}).
		Where("id = ?", id).
		Update("is_active", false).Error
}

// LTIDeploymentRepository defines operations for LTI deployment data
type LTIDeploymentRepository interface {
	Create(ctx context.Context, dep *domain.LTIDeployment) error
	GetByDeploymentID(ctx context.Context, deploymentID string) (*domain.LTIDeployment, error)
	GetByToolID(ctx context.Context, toolID uuid.UUID) ([]*domain.LTIDeployment, error)
	Update(ctx context.Context, dep *domain.LTIDeployment) error
	Delete(ctx context.Context, id uuid.UUID) error
}

type ltiDeploymentRepository struct {
	db *gorm.DB
}

// NewLTIDeploymentRepository creates a new LTI deployment repository
func NewLTIDeploymentRepository(db *gorm.DB) LTIDeploymentRepository {
	return &ltiDeploymentRepository{db: db}
}

func (r *ltiDeploymentRepository) Create(ctx context.Context, dep *domain.LTIDeployment) error {
	dep.ID = uuid.New()
	return r.db.WithContext(ctx).Create(dep).Error
}

func (r *ltiDeploymentRepository) GetByDeploymentID(ctx context.Context, deploymentID string) (*domain.LTIDeployment, error) {
	var dep domain.LTIDeployment
	err := r.db.WithContext(ctx).
		Where("deployment_id = ? AND is_active = ?", deploymentID, true).
		First(&dep).Error
	if err != nil {
		return nil, err
	}
	return &dep, nil
}

func (r *ltiDeploymentRepository) GetByToolID(ctx context.Context, toolID uuid.UUID) ([]*domain.LTIDeployment, error) {
	var deps []*domain.LTIDeployment
	err := r.db.WithContext(ctx).
		Where("tool_id = ? AND is_active = ?", toolID, true).
		Find(&deps).Error
	return deps, err
}

func (r *ltiDeploymentRepository) Update(ctx context.Context, dep *domain.LTIDeployment) error {
	return r.db.WithContext(ctx).Save(dep).Error
}

func (r *ltiDeploymentRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).
		Model(&domain.LTIDeployment{}).
		Where("id = ?", id).
		Update("is_active", false).Error
}

// LTIContextRepository defines operations for LTI context data
type LTIContextRepository interface {
	Create(ctx context.Context, c *domain.LTIContext) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.LTIContext, error)
	GetByContextID(ctx context.Context, contextID string) (*domain.LTIContext, error)
	GetByTenant(ctx context.Context, tenantID uuid.UUID) ([]*domain.LTIContext, error)
	Update(ctx context.Context, c *domain.LTIContext) error
	Delete(ctx context.Context, id uuid.UUID) error
}

type ltiContextRepository struct {
	db *gorm.DB
}

// NewLTIContextRepository creates a new LTI context repository
func NewLTIContextRepository(db *gorm.DB) LTIContextRepository {
	return &ltiContextRepository{db: db}
}

func (r *ltiContextRepository) Create(ctx context.Context, c *domain.LTIContext) error {
	c.ID = uuid.New()
	return r.db.WithContext(ctx).Create(c).Error
}

func (r *ltiContextRepository) GetByID(ctx context.Context, id uuid.UUID) (*domain.LTIContext, error) {
	var c domain.LTIContext
	err := r.db.WithContext(ctx).
		Where("id = ?", id).
		First(&c).Error
	return &c, err
}

func (r *ltiContextRepository) GetByContextID(ctx context.Context, contextID string) (*domain.LTIContext, error) {
	var c domain.LTIContext
	err := r.db.WithContext(ctx).
		Where("context_id = ?", contextID).
		First(&c).Error
	return &c, err
}

func (r *ltiContextRepository) GetByTenant(ctx context.Context, tenantID uuid.UUID) ([]*domain.LTIContext, error) {
	var contexts []*domain.LTIContext
	err := r.db.WithContext(ctx).
		Where("tenant_id = ?", tenantID).
		Find(&contexts).Error
	return contexts, err
}

func (r *ltiContextRepository) Update(ctx context.Context, c *domain.LTIContext) error {
	return r.db.WithContext(ctx).Save(c).Error
}

func (r *ltiContextRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).
		Where("id = ?", id).
		Delete(&domain.LTIContext{}).Error
}