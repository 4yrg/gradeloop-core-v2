package ports

import (
	"context"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
	"github.com/google/uuid"
)

// BatchRepository defines the interface for batch data access operations.
type BatchRepository interface {
	// CreateBatch creates a new batch in the database.
	CreateBatch(ctx context.Context, batch *models.Batch) (*models.Batch, error)

	// GetBatchByID retrieves a single batch by its ID.
	// If includeInactive is false, only active batches are returned.
	GetBatchByID(ctx context.Context, id uuid.UUID, includeInactive bool) (*models.Batch, error)

	// GetDirectChildren retrieves all immediate children of a parent batch.
	// If includeInactive is false, only active children are returned.
	GetDirectChildren(ctx context.Context, parentID uuid.UUID, includeInactive bool) ([]models.Batch, error)

	// GetSubtree retrieves the entire subtree starting from a root batch using recursive CTE.
	// Returns all descendants in a flat list (not nested structure).
	// If includeInactive is false, only active batches are returned.
	GetSubtree(ctx context.Context, rootID uuid.UUID, includeInactive bool) ([]models.Batch, error)

	// UpdateBatch updates an existing batch in the database.
	UpdateBatch(ctx context.Context, batch *models.Batch) (*models.Batch, error)

	// DeleteBatch soft-deletes a batch by setting is_active=false and deleted_at.
	DeleteBatch(ctx context.Context, id uuid.UUID) error

	// HasCycle checks if setting newParentID as the parent of batchID would create a cycle.
	// Returns true if a cycle would be created, false otherwise.
	HasCycle(ctx context.Context, batchID uuid.UUID, newParentID uuid.UUID) (bool, error)

	// GetAncestorChain retrieves all ancestors of a batch from immediate parent to root.
	// Used for validation and RBAC checks.
	GetAncestorChain(ctx context.Context, batchID uuid.UUID) ([]models.Batch, error)

	// GetAllDescendantIDs retrieves all descendant IDs for recursive cascade operations.
	// Returns IDs in bottom-up order (leaves first, then parents).
	GetAllDescendantIDs(ctx context.Context, rootID uuid.UUID) ([]uuid.UUID, error)
}
