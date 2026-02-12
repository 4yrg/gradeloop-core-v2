package usecases

import (
	"context"
	"fmt"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/dto"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/ports"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/utils"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
	"github.com/google/uuid"
)

// BatchService handles the business logic for batch management.
type BatchService struct {
	batchRepo          ports.BatchRepository
	degreeRepo         ports.DegreeRepository
	specializationRepo ports.SpecializationRepository
	departmentRepo     ports.DepartmentRepository
	auditRepo          ports.AuditRepository
}

// NewBatchService creates a new BatchService.
func NewBatchService(
	batchRepo ports.BatchRepository,
	degreeRepo ports.DegreeRepository,
	specializationRepo ports.SpecializationRepository,
	departmentRepo ports.DepartmentRepository,
	auditRepo ports.AuditRepository,
) *BatchService {
	return &BatchService{
		batchRepo:          batchRepo,
		degreeRepo:         degreeRepo,
		specializationRepo: specializationRepo,
		departmentRepo:     departmentRepo,
		auditRepo:          auditRepo,
	}
}

// CreateBatch handles creating a new batch with hierarchy support and business rule enforcement.
func (s *BatchService) CreateBatch(ctx context.Context, req dto.CreateBatchRequest) (*models.Batch, error) {
	user, err := GetUserFromContext(ctx)
	if err != nil {
		return nil, &utils.AppError{Code: 403, Message: "Forbidden: " + err.Error()}
	}

	// Business Rule: Validate year range
	if req.EndYear <= req.StartYear {
		return nil, &utils.AppError{Code: 400, Message: "end_year must be greater than start_year"}
	}

	var batch *models.Batch
	var degree *models.Degree

	// Handle root batch vs child batch logic
	if req.ParentID == nil {
		// ROOT BATCH: degree_id is required
		if req.DegreeID == nil {
			return nil, &utils.AppError{Code: 400, Message: "degree_id is required for root batches"}
		}

		// Validate degree exists and is active
		degree, err = s.degreeRepo.GetDegreeByID(ctx, *req.DegreeID, false)
		if err != nil {
			return nil, &utils.AppError{Code: 404, Message: "Active degree not found"}
		}

		batch = &models.Batch{
			DegreeID:         *req.DegreeID,
			SpecializationID: req.SpecializationID,
			Name:             req.Name,
			Code:             req.Code,
			StartYear:        req.StartYear,
			EndYear:          req.EndYear,
		}
	} else {
		// CHILD BATCH: parent must exist and be active
		parent, err := s.batchRepo.GetBatchByID(ctx, *req.ParentID, false)
		if err != nil {
			return nil, &utils.AppError{Code: 404, Message: "Active parent batch not found"}
		}

		// Inherit degree_id from parent if not provided
		degreeID := parent.DegreeID
		if req.DegreeID != nil {
			// If degree_id is explicitly provided, validate it matches parent's degree tree
			if err := s.validateDegreeInheritance(ctx, parent, *req.DegreeID); err != nil {
				return nil, err
			}
			degreeID = *req.DegreeID
		}

		// Get degree for RBAC validation
		degree, err = s.degreeRepo.GetDegreeByID(ctx, degreeID, false)
		if err != nil {
			return nil, &utils.AppError{Code: 404, Message: "Active degree not found"}
		}

		// Check for cycle before creating
		hasCycle, err := s.batchRepo.HasCycle(ctx, uuid.New(), *req.ParentID)
		if err != nil {
			return nil, &utils.AppError{Code: 500, Message: "Failed to check for cycles: " + err.Error()}
		}
		if hasCycle {
			return nil, &utils.AppError{Code: 400, Message: "Creating this batch would create a cycle in the hierarchy"}
		}

		batch = &models.Batch{
			ParentID:         req.ParentID,
			DegreeID:         degreeID,
			SpecializationID: req.SpecializationID,
			Name:             req.Name,
			Code:             req.Code,
			StartYear:        req.StartYear,
			EndYear:          req.EndYear,
		}
	}

	// Validate specialization belongs to degree (if provided)
	if req.SpecializationID != nil {
		if err := s.validateSpecializationBelongsToDegree(ctx, *req.SpecializationID, batch.DegreeID); err != nil {
			return nil, err
		}
	}

	// RBAC Enforcement: Validate access via degree → department → faculty
	if err := s.validateBatchAccess(ctx, user, degree); err != nil {
		return nil, err
	}

	// Create the batch
	createdBatch, err := s.batchRepo.CreateBatch(ctx, batch)
	if err != nil {
		return nil, &utils.AppError{Code: 409, Message: "Conflict: " + err.Error()}
	}

	// Audit log
	auditLog := utils.PrepareAuditLog(ctx, "batch.create", "batch", createdBatch.ID.String(), nil, createdBatch)
	s.auditRepo.CreateAuditLog(ctx, auditLog)

	return createdBatch, nil
}

// GetBatch retrieves a single batch by its ID.
func (s *BatchService) GetBatch(ctx context.Context, id uuid.UUID, includeInactive bool) (*models.Batch, error) {
	batch, err := s.batchRepo.GetBatchByID(ctx, id, includeInactive)
	if err != nil {
		return nil, &utils.AppError{Code: 404, Message: "Batch not found"}
	}
	return batch, nil
}

// GetDirectChildren retrieves all immediate children of a batch.
func (s *BatchService) GetDirectChildren(ctx context.Context, parentID uuid.UUID, includeInactive bool) ([]models.Batch, error) {
	// Ensure parent exists
	if _, err := s.batchRepo.GetBatchByID(ctx, parentID, true); err != nil {
		return nil, &utils.AppError{Code: 404, Message: "Parent batch not found"}
	}

	return s.batchRepo.GetDirectChildren(ctx, parentID, includeInactive)
}

// GetSubtree retrieves the entire subtree starting from a root batch.
func (s *BatchService) GetSubtree(ctx context.Context, rootID uuid.UUID, includeInactive bool) ([]models.Batch, error) {
	// Ensure root exists
	if _, err := s.batchRepo.GetBatchByID(ctx, rootID, true); err != nil {
		return nil, &utils.AppError{Code: 404, Message: "Root batch not found"}
	}

	return s.batchRepo.GetSubtree(ctx, rootID, includeInactive)
}

// UpdateBatch handles updating a batch's details, enforcing RBAC and business rules.
func (s *BatchService) UpdateBatch(ctx context.Context, id uuid.UUID, req dto.UpdateBatchRequest) (*models.Batch, error) {
	user, err := GetUserFromContext(ctx)
	if err != nil {
		return nil, &utils.AppError{Code: 403, Message: "Forbidden: " + err.Error()}
	}

	batch, err := s.batchRepo.GetBatchByID(ctx, id, true)
	if err != nil {
		return nil, &utils.AppError{Code: 404, Message: "Batch not found"}
	}
	oldBatchState := *batch

	// Get degree for RBAC validation
	degree, err := s.degreeRepo.GetDegreeByID(ctx, batch.DegreeID, true)
	if err != nil {
		return nil, &utils.AppError{Code: 404, Message: "Degree not found"}
	}

	// RBAC Enforcement
	if err := s.validateBatchAccess(ctx, user, degree); err != nil {
		return nil, err
	}

	// Apply updates
	if req.Name != nil {
		batch.Name = *req.Name
	}
	if req.Code != nil {
		batch.Code = *req.Code
	}
	if req.StartYear != nil {
		batch.StartYear = *req.StartYear
	}
	if req.EndYear != nil {
		batch.EndYear = *req.EndYear
	}

	// Validate year range after updates
	if batch.EndYear <= batch.StartYear {
		return nil, &utils.AppError{Code: 400, Message: "end_year must be greater than start_year"}
	}

	// Handle specialization update
	if req.SpecializationID != nil {
		if err := s.validateSpecializationBelongsToDegree(ctx, *req.SpecializationID, batch.DegreeID); err != nil {
			return nil, err
		}
		batch.SpecializationID = req.SpecializationID
	}

	updatedBatch, err := s.batchRepo.UpdateBatch(ctx, batch)
	if err != nil {
		return nil, &utils.AppError{Code: 409, Message: "Conflict: " + err.Error()}
	}

	auditLog := utils.PrepareAuditLog(ctx, "batch.update", "batch", updatedBatch.ID.String(), oldBatchState, updatedBatch)
	s.auditRepo.CreateAuditLog(ctx, auditLog)

	return updatedBatch, nil
}

// DeleteBatch handles recursive cascade soft-delete of a batch and all its descendants.
func (s *BatchService) DeleteBatch(ctx context.Context, id uuid.UUID) error {
	user, err := GetUserFromContext(ctx)
	if err != nil {
		return &utils.AppError{Code: 403, Message: "Forbidden: " + err.Error()}
	}

	batch, err := s.batchRepo.GetBatchByID(ctx, id, true)
	if err != nil {
		return &utils.AppError{Code: 404, Message: "Batch not found"}
	}
	oldBatchState := *batch

	// Get degree for RBAC validation
	degree, err := s.degreeRepo.GetDegreeByID(ctx, batch.DegreeID, true)
	if err != nil {
		return &utils.AppError{Code: 404, Message: "Degree not found"}
	}

	// RBAC Enforcement
	if err := s.validateBatchAccess(ctx, user, degree); err != nil {
		return err
	}

	// Get all descendant IDs for cascade delete (bottom-up order)
	descendantIDs, err := s.batchRepo.GetAllDescendantIDs(ctx, id)
	if err != nil {
		return &utils.AppError{Code: 500, Message: "Failed to get descendants: " + err.Error()}
	}

	// Soft-delete all descendants first (bottom-up)
	for _, descendantID := range descendantIDs {
		descendant, err := s.batchRepo.GetBatchByID(ctx, descendantID, true)
		if err != nil {
			continue // Skip if already deleted
		}
		oldDescendantState := *descendant

		if err := s.batchRepo.DeleteBatch(ctx, descendantID); err != nil {
			return &utils.AppError{Code: 500, Message: fmt.Sprintf("Failed to delete descendant batch %s: %s", descendantID, err.Error())}
		}

		newDescendantState := oldDescendantState
		newDescendantState.IsActive = false
		auditLog := utils.PrepareAuditLog(ctx, "batch.cascade_delete", "batch", descendantID.String(), oldDescendantState, newDescendantState)
		s.auditRepo.CreateAuditLog(ctx, auditLog)
	}

	// Now delete the target batch
	if err := s.batchRepo.DeleteBatch(ctx, id); err != nil {
		return &utils.AppError{Code: 500, Message: "Failed to delete batch: " + err.Error()}
	}

	newBatchState := oldBatchState
	newBatchState.IsActive = false
	auditLog := utils.PrepareAuditLog(ctx, "batch.delete", "batch", id.String(), oldBatchState, newBatchState)
	s.auditRepo.CreateAuditLog(ctx, auditLog)

	return nil
}

// validateBatchAccess checks if the user has access to manage batches in the given degree.
func (s *BatchService) validateBatchAccess(ctx context.Context, user *AuthUser, degree *models.Degree) error {
	// Get department for faculty relationship
	department, err := s.departmentRepo.GetDepartmentByID(ctx, degree.DepartmentID, true)
	if err != nil {
		return &utils.AppError{Code: 404, Message: "Department not found"}
	}

	isSuperAdmin := user.HasRole("super_admin")
	isFacultyAdmin := user.HasRole("faculty_admin") && user.FacultyID != nil && *user.FacultyID == department.FacultyID

	// For department_admin, check if they have department_id in context
	isDepartmentAdmin := false
	if user.HasRole("department_admin") {
		if deptIDVal := ctx.Value("department_id"); deptIDVal != nil {
			if deptIDStr, ok := deptIDVal.(string); ok {
				if deptID, err := uuid.Parse(deptIDStr); err == nil {
					isDepartmentAdmin = deptID == department.ID
				}
			}
		}
	}

	if !isSuperAdmin && !isFacultyAdmin && !isDepartmentAdmin {
		return &utils.AppError{Code: 403, Message: "Forbidden: User is not authorized to manage batches in this degree"}
	}

	return nil
}

// validateDegreeInheritance ensures child batch's degree is within the same degree tree as parent.
func (s *BatchService) validateDegreeInheritance(ctx context.Context, parent *models.Batch, childDegreeID uuid.UUID) error {
	// For simplicity, we enforce that child must have the same degree as parent
	// This prevents cross-degree nesting
	if parent.DegreeID != childDegreeID {
		return &utils.AppError{Code: 400, Message: "Child batch must belong to the same degree as parent"}
	}
	return nil
}

// validateSpecializationBelongsToDegree ensures the specialization belongs to the specified degree.
func (s *BatchService) validateSpecializationBelongsToDegree(ctx context.Context, specializationID uuid.UUID, degreeID uuid.UUID) error {
	specialization, err := s.specializationRepo.GetSpecializationByID(ctx, specializationID, false)
	if err != nil {
		return &utils.AppError{Code: 404, Message: "Active specialization not found"}
	}

	if specialization.DegreeID != degreeID {
		return &utils.AppError{Code: 400, Message: "Specialization does not belong to the specified degree"}
	}

	return nil
}
