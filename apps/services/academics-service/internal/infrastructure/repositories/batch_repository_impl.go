package repositories

import (
	"context"
	"errors"
	"fmt"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/ports"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// BatchRepositoryImpl implements the BatchRepository interface using GORM.
type BatchRepositoryImpl struct {
	db *gorm.DB
}

// NewBatchRepository creates a new instance of BatchRepositoryImpl.
func NewBatchRepository(db *gorm.DB) ports.BatchRepository {
	return &BatchRepositoryImpl{db: db}
}

// CreateBatch creates a new batch in the database.
func (r *BatchRepositoryImpl) CreateBatch(ctx context.Context, batch *models.Batch) (*models.Batch, error) {
	if err := r.db.WithContext(ctx).Create(batch).Error; err != nil {
		return nil, fmt.Errorf("failed to create batch: %w", err)
	}

	// Reload with relationships
	return r.GetBatchByID(ctx, batch.ID, true)
}

// GetBatchByID retrieves a single batch by its ID with relationships preloaded.
func (r *BatchRepositoryImpl) GetBatchByID(ctx context.Context, id uuid.UUID, includeInactive bool) (*models.Batch, error) {
	var batch models.Batch
	query := r.db.WithContext(ctx).
		Preload("Parent").
		Preload("Degree").
		Preload("Specialization")

	if !includeInactive {
		query = query.Where("is_active = ?", true)
	}

	if err := query.First(&batch, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("batch not found")
		}
		return nil, fmt.Errorf("failed to get batch: %w", err)
	}

	return &batch, nil
}

// GetDirectChildren retrieves all immediate children of a parent batch.
func (r *BatchRepositoryImpl) GetDirectChildren(ctx context.Context, parentID uuid.UUID, includeInactive bool) ([]models.Batch, error) {
	var batches []models.Batch
	query := r.db.WithContext(ctx).
		Preload("Degree").
		Preload("Specialization").
		Where("parent_id = ?", parentID)

	if !includeInactive {
		query = query.Where("is_active = ?", true)
	}

	if err := query.Find(&batches).Error; err != nil {
		return nil, fmt.Errorf("failed to get children: %w", err)
	}

	return batches, nil
}

// GetSubtree retrieves the entire subtree using recursive CTE.
func (r *BatchRepositoryImpl) GetSubtree(ctx context.Context, rootID uuid.UUID, includeInactive bool) ([]models.Batch, error) {
	var batches []models.Batch

	// Build recursive CTE query
	activeFilter := ""
	if !includeInactive {
		activeFilter = "AND is_active = true AND deleted_at IS NULL"
	} else {
		activeFilter = "AND deleted_at IS NULL"
	}

	query := fmt.Sprintf(`
		WITH RECURSIVE batch_tree AS (
			-- Base case: select the root batch
			SELECT * FROM batches 
			WHERE id = ? %s
			
			UNION ALL
			
			-- Recursive case: select children of batches in the tree
			SELECT b.* FROM batches b
			INNER JOIN batch_tree bt ON b.parent_id = bt.id
			WHERE b.deleted_at IS NULL %s
		)
		SELECT * FROM batch_tree
	`, activeFilter, activeFilter)

	if err := r.db.WithContext(ctx).Raw(query, rootID).Scan(&batches).Error; err != nil {
		return nil, fmt.Errorf("failed to get subtree: %w", err)
	}

	// Preload relationships for all batches
	if len(batches) > 0 {
		var ids []uuid.UUID
		for _, b := range batches {
			ids = append(ids, b.ID)
		}

		// Reload with relationships
		if err := r.db.WithContext(ctx).
			Preload("Degree").
			Preload("Specialization").
			Where("id IN ?", ids).
			Find(&batches).Error; err != nil {
			return nil, fmt.Errorf("failed to preload relationships: %w", err)
		}
	}

	return batches, nil
}

// UpdateBatch updates an existing batch in the database.
func (r *BatchRepositoryImpl) UpdateBatch(ctx context.Context, batch *models.Batch) (*models.Batch, error) {
	if err := r.db.WithContext(ctx).Save(batch).Error; err != nil {
		return nil, fmt.Errorf("failed to update batch: %w", err)
	}

	// Reload with relationships
	return r.GetBatchByID(ctx, batch.ID, true)
}

// DeleteBatch soft-deletes a batch.
func (r *BatchRepositoryImpl) DeleteBatch(ctx context.Context, id uuid.UUID) error {
	result := r.db.WithContext(ctx).
		Model(&models.Batch{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"is_active":  false,
			"deleted_at": gorm.Expr("NOW()"),
		})

	if result.Error != nil {
		return fmt.Errorf("failed to delete batch: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return fmt.Errorf("batch not found")
	}

	return nil
}

// HasCycle checks if setting newParentID as the parent of batchID would create a cycle.
func (r *BatchRepositoryImpl) HasCycle(ctx context.Context, batchID uuid.UUID, newParentID uuid.UUID) (bool, error) {
	// Self-parenting check
	if batchID == newParentID {
		return true, nil
	}

	// Check if newParentID is a descendant of batchID using recursive CTE
	query := `
		WITH RECURSIVE ancestors AS (
			-- Base case: start with the proposed new parent
			SELECT id, parent_id FROM batches WHERE id = ?
			
			UNION ALL
			
			-- Recursive case: traverse up the tree
			SELECT b.id, b.parent_id FROM batches b
			INNER JOIN ancestors a ON b.id = a.parent_id
			WHERE b.deleted_at IS NULL
		)
		SELECT EXISTS(SELECT 1 FROM ancestors WHERE id = ?)
	`

	var hasCycle bool
	if err := r.db.WithContext(ctx).Raw(query, newParentID, batchID).Scan(&hasCycle).Error; err != nil {
		return false, fmt.Errorf("failed to check cycle: %w", err)
	}

	return hasCycle, nil
}

// GetAncestorChain retrieves all ancestors from immediate parent to root.
func (r *BatchRepositoryImpl) GetAncestorChain(ctx context.Context, batchID uuid.UUID) ([]models.Batch, error) {
	var ancestors []models.Batch

	query := `
		WITH RECURSIVE ancestor_chain AS (
			-- Base case: get the batch itself
			SELECT * FROM batches WHERE id = ?
			
			UNION ALL
			
			-- Recursive case: get parent
			SELECT b.* FROM batches b
			INNER JOIN ancestor_chain ac ON b.id = ac.parent_id
			WHERE b.deleted_at IS NULL
		)
		SELECT * FROM ancestor_chain WHERE id != ?
	`

	if err := r.db.WithContext(ctx).Raw(query, batchID, batchID).Scan(&ancestors).Error; err != nil {
		return nil, fmt.Errorf("failed to get ancestor chain: %w", err)
	}

	return ancestors, nil
}

// GetAllDescendantIDs retrieves all descendant IDs in bottom-up order.
func (r *BatchRepositoryImpl) GetAllDescendantIDs(ctx context.Context, rootID uuid.UUID) ([]uuid.UUID, error) {
	var ids []uuid.UUID

	// Get all descendants using recursive CTE
	query := `
		WITH RECURSIVE batch_tree AS (
			SELECT id, parent_id FROM batches WHERE id = ? AND deleted_at IS NULL
			
			UNION ALL
			
			SELECT b.id, b.parent_id FROM batches b
			INNER JOIN batch_tree bt ON b.parent_id = bt.id
			WHERE b.deleted_at IS NULL
		)
		SELECT id FROM batch_tree WHERE id != ?
	`

	if err := r.db.WithContext(ctx).Raw(query, rootID, rootID).Scan(&ids).Error; err != nil {
		return nil, fmt.Errorf("failed to get descendant IDs: %w", err)
	}

	// Reverse the order to get bottom-up (leaves first)
	for i, j := 0, len(ids)-1; i < j; i, j = i+1, j-1 {
		ids[i], ids[j] = ids[j], ids[i]
	}

	return ids, nil
}
