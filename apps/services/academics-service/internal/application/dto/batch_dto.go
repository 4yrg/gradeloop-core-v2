package dto

import (
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
	"github.com/google/uuid"
)

// CreateBatchRequest represents the request to create a new batch.
type CreateBatchRequest struct {
	ParentID         *uuid.UUID `json:"parent_id"`         // Optional: null for root batches
	DegreeID         *uuid.UUID `json:"degree_id"`         // Required for root batches, optional for children (inherited)
	SpecializationID *uuid.UUID `json:"specialization_id"` // Optional
	Name             string     `json:"name" validate:"required,min=1,max=255"`
	Code             string     `json:"code" validate:"required,min=1,max=50"`
	StartYear        int        `json:"start_year" validate:"required,min=1900,max=2100"`
	EndYear          int        `json:"end_year" validate:"required,min=1900,max=2100"`
}

// UpdateBatchRequest represents the request to update an existing batch.
// All fields are optional (partial update).
type UpdateBatchRequest struct {
	Name             *string    `json:"name,omitempty" validate:"omitempty,min=1,max=255"`
	Code             *string    `json:"code,omitempty" validate:"omitempty,min=1,max=50"`
	SpecializationID *uuid.UUID `json:"specialization_id,omitempty"`
	StartYear        *int       `json:"start_year,omitempty" validate:"omitempty,min=1900,max=2100"`
	EndYear          *int       `json:"end_year,omitempty" validate:"omitempty,min=1900,max=2100"`
	// Note: parent_id cannot be changed after creation (business rule)
}

// BatchResponse represents the response for a single batch.
type BatchResponse struct {
	ID               uuid.UUID              `json:"id"`
	ParentID         *uuid.UUID             `json:"parent_id,omitempty"`
	DegreeID         uuid.UUID              `json:"degree_id"`
	SpecializationID *uuid.UUID             `json:"specialization_id,omitempty"`
	Name             string                 `json:"name"`
	Code             string                 `json:"code"`
	StartYear        int                    `json:"start_year"`
	EndYear          int                    `json:"end_year"`
	IsActive         bool                   `json:"is_active"`
	CreatedAt        string                 `json:"created_at"`
	UpdatedAt        string                 `json:"updated_at"`
	Parent           *BatchResponse         `json:"parent,omitempty"`
	Degree           *DegreeSummary         `json:"degree,omitempty"`
	Specialization   *SpecializationSummary `json:"specialization,omitempty"`
}

// BatchTreeNode represents a batch with its children in a tree structure.
type BatchTreeNode struct {
	ID               uuid.UUID              `json:"id"`
	ParentID         *uuid.UUID             `json:"parent_id,omitempty"`
	DegreeID         uuid.UUID              `json:"degree_id"`
	SpecializationID *uuid.UUID             `json:"specialization_id,omitempty"`
	Name             string                 `json:"name"`
	Code             string                 `json:"code"`
	StartYear        int                    `json:"start_year"`
	EndYear          int                    `json:"end_year"`
	IsActive         bool                   `json:"is_active"`
	Degree           *DegreeSummary         `json:"degree,omitempty"`
	Specialization   *SpecializationSummary `json:"specialization,omitempty"`
	Children         []BatchTreeNode        `json:"children"`
}

// DegreeSummary represents a minimal degree representation for batch responses.
type DegreeSummary struct {
	ID    uuid.UUID          `json:"id"`
	Name  string             `json:"name"`
	Code  string             `json:"code"`
	Level models.DegreeLevel `json:"level"`
}

// SpecializationSummary represents a minimal specialization representation for batch responses.
type SpecializationSummary struct {
	ID   uuid.UUID `json:"id"`
	Name string    `json:"name"`
	Code string    `json:"code"`
}

// ToBatchResponse converts a Batch model to BatchResponse DTO.
func ToBatchResponse(batch *models.Batch) *BatchResponse {
	if batch == nil {
		return nil
	}

	resp := &BatchResponse{
		ID:               batch.ID,
		ParentID:         batch.ParentID,
		DegreeID:         batch.DegreeID,
		SpecializationID: batch.SpecializationID,
		Name:             batch.Name,
		Code:             batch.Code,
		StartYear:        batch.StartYear,
		EndYear:          batch.EndYear,
		IsActive:         batch.IsActive,
		CreatedAt:        batch.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:        batch.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}

	// Include parent if loaded
	if batch.Parent != nil {
		resp.Parent = ToBatchResponse(batch.Parent)
	}

	// Include degree summary if loaded
	if batch.Degree.ID != uuid.Nil {
		resp.Degree = &DegreeSummary{
			ID:    batch.Degree.ID,
			Name:  batch.Degree.Name,
			Code:  batch.Degree.Code,
			Level: batch.Degree.Level,
		}
	}

	// Include specialization summary if loaded
	if batch.Specialization != nil && batch.Specialization.ID != uuid.Nil {
		resp.Specialization = &SpecializationSummary{
			ID:   batch.Specialization.ID,
			Name: batch.Specialization.Name,
			Code: batch.Specialization.Code,
		}
	}

	return resp
}

// ToBatchListResponse converts a slice of Batch models to BatchResponse DTOs.
func ToBatchListResponse(batches []models.Batch) []BatchResponse {
	responses := make([]BatchResponse, len(batches))
	for i, batch := range batches {
		resp := ToBatchResponse(&batch)
		if resp != nil {
			responses[i] = *resp
		}
	}
	return responses
}

// BuildBatchTree converts a flat list of batches into a hierarchical tree structure.
func BuildBatchTree(batches []models.Batch, rootID uuid.UUID) *BatchTreeNode {
	// Create a map for quick lookup
	batchMap := make(map[uuid.UUID]*models.Batch)
	for i := range batches {
		batchMap[batches[i].ID] = &batches[i]
	}

	// Find root
	root, exists := batchMap[rootID]
	if !exists {
		return nil
	}

	return buildTreeNode(root, batchMap)
}

// buildTreeNode recursively builds a tree node with its children.
func buildTreeNode(batch *models.Batch, batchMap map[uuid.UUID]*models.Batch) *BatchTreeNode {
	node := &BatchTreeNode{
		ID:               batch.ID,
		ParentID:         batch.ParentID,
		DegreeID:         batch.DegreeID,
		SpecializationID: batch.SpecializationID,
		Name:             batch.Name,
		Code:             batch.Code,
		StartYear:        batch.StartYear,
		EndYear:          batch.EndYear,
		IsActive:         batch.IsActive,
		Children:         []BatchTreeNode{},
	}

	// Add degree summary
	if batch.Degree.ID != uuid.Nil {
		node.Degree = &DegreeSummary{
			ID:    batch.Degree.ID,
			Name:  batch.Degree.Name,
			Code:  batch.Degree.Code,
			Level: batch.Degree.Level,
		}
	}

	// Add specialization summary
	if batch.Specialization != nil && batch.Specialization.ID != uuid.Nil {
		node.Specialization = &SpecializationSummary{
			ID:   batch.Specialization.ID,
			Name: batch.Specialization.Name,
			Code: batch.Specialization.Code,
		}
	}

	// Find and add children
	for _, b := range batchMap {
		if b.ParentID != nil && *b.ParentID == batch.ID {
			childNode := buildTreeNode(b, batchMap)
			node.Children = append(node.Children, *childNode)
		}
	}

	return node
}
