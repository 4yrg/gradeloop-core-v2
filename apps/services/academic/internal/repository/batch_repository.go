package repository

import (
	"errors"

	"github.com/google/uuid"
	"github.com/gradeloop/academic-service/internal/domain"
	"gorm.io/gorm"
)

// BatchRepository defines all data operations for batches.
type BatchRepository interface {
	CreateBatch(batch *domain.Batch) error
	UpdateBatch(batch *domain.Batch) error
	GetBatchByID(id uuid.UUID) (*domain.Batch, error)
	ListBatches(includeInactive bool) ([]domain.Batch, error)
	ListRootBatches(includeInactive bool) ([]domain.Batch, error)
	ListChildren(parentID uuid.UUID) ([]domain.Batch, error)
	SoftDeleteBatch(id uuid.UUID) error
	DeactivateSubtree(batchID uuid.UUID) error
	GetBatchByCodeAndDegree(code string, degreeID uuid.UUID) (*domain.Batch, error)
	GetAllBatchesTree(includeInactive bool) ([]domain.Batch, error)
}

// batchRepository is the concrete GORM-backed implementation.
type batchRepository struct {
	db *gorm.DB
}

// NewBatchRepository creates a new batchRepository.
func NewBatchRepository(db *gorm.DB) BatchRepository {
	return &batchRepository{db: db}
}

// CreateBatch inserts a new batch record.
func (r *batchRepository) CreateBatch(batch *domain.Batch) error {
	return r.db.Create(batch).Error
}

// UpdateBatch saves changes to an existing batch record.
func (r *batchRepository) UpdateBatch(batch *domain.Batch) error {
	return r.db.Save(batch).Error
}

// GetBatchByID loads a single batch by primary key (non-deleted).
func (r *batchRepository) GetBatchByID(id uuid.UUID) (*domain.Batch, error) {
	var batch domain.Batch
	err := r.db.
		Where("id = ? AND deleted_at IS NULL", id).
		First(&batch).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	return &batch, nil
}

// ListBatches returns all non-deleted batches, optionally including inactive ones.
func (r *batchRepository) ListBatches(includeInactive bool) ([]domain.Batch, error) {
	var batches []domain.Batch

	query := r.db.Where("deleted_at IS NULL")
	if !includeInactive {
		query = query.Where("is_active = ?", true)
	}

	err := query.Order("created_at ASC").Find(&batches).Error
	return batches, err
}

// ListRootBatches returns only top-level batches (parent_id IS NULL).
func (r *batchRepository) ListRootBatches(includeInactive bool) ([]domain.Batch, error) {
	var batches []domain.Batch

	query := r.db.Where("parent_id IS NULL AND deleted_at IS NULL")
	if !includeInactive {
		query = query.Where("is_active = ?", true)
	}

	err := query.Order("created_at ASC").Find(&batches).Error
	return batches, err
}

// ListChildren returns direct children of the given parent batch.
func (r *batchRepository) ListChildren(parentID uuid.UUID) ([]domain.Batch, error) {
	var batches []domain.Batch

	err := r.db.
		Where("parent_id = ? AND deleted_at IS NULL", parentID).
		Order("created_at ASC").
		Find(&batches).Error

	return batches, err
}

// SoftDeleteBatch sets deleted_at for a batch (does NOT cascade — service handles that).
func (r *batchRepository) SoftDeleteBatch(id uuid.UUID) error {
	return r.db.Model(&domain.Batch{}).
		Where("id = ?", id).
		Update("deleted_at", gorm.Expr("NOW()")).Error
}

// DeactivateSubtree sets is_active = false for the batch and every descendant.
// It uses a recursive CTE so we never need to load the full tree into Go memory.
func (r *batchRepository) DeactivateSubtree(batchID uuid.UUID) error {
	return r.db.Exec(`
		WITH RECURSIVE subtree AS (
			SELECT id FROM batches WHERE id = ? AND deleted_at IS NULL
			UNION ALL
			SELECT b.id FROM batches b
			INNER JOIN subtree s ON b.parent_id = s.id
			WHERE b.deleted_at IS NULL
		)
		UPDATE batches
		SET is_active = false, updated_at = NOW()
		WHERE id IN (SELECT id FROM subtree)
	`, batchID).Error
}

// GetBatchByCodeAndDegree looks up a batch by its code within a degree (for uniqueness checks).
func (r *batchRepository) GetBatchByCodeAndDegree(code string, degreeID uuid.UUID) (*domain.Batch, error) {
	var batch domain.Batch
	err := r.db.
		Where("code = ? AND degree_id = ? AND deleted_at IS NULL", code, degreeID).
		First(&batch).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	return &batch, nil
}

// GetAllBatchesTree loads every non-deleted batch in a single query so the
// service layer can assemble the tree structure in memory efficiently.
func (r *batchRepository) GetAllBatchesTree(includeInactive bool) ([]domain.Batch, error) {
	var batches []domain.Batch

	query := r.db.Where("deleted_at IS NULL")
	if !includeInactive {
		query = query.Where("is_active = ?", true)
	}

	err := query.Order("created_at ASC").Find(&batches).Error
	return batches, err
}
