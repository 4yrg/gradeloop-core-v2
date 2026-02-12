package usecases

import (
	"context"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/dto"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/ports"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/utils"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
	"github.com/google/uuid"
)

// SpecializationService handles the business logic for specialization management.
type SpecializationService struct {
	specializationRepo ports.SpecializationRepository
	degreeRepo         ports.DegreeRepository
	departmentRepo     ports.DepartmentRepository
	auditRepo          ports.AuditRepository
}

// NewSpecializationService creates a new SpecializationService.
func NewSpecializationService(
	specializationRepo ports.SpecializationRepository,
	degreeRepo ports.DegreeRepository,
	departmentRepo ports.DepartmentRepository,
	auditRepo ports.AuditRepository,
) *SpecializationService {
	return &SpecializationService{
		specializationRepo: specializationRepo,
		degreeRepo:         degreeRepo,
		departmentRepo:     departmentRepo,
		auditRepo:          auditRepo,
	}
}

// CreateSpecialization handles creating a new specialization, enforcing business rules and RBAC.
func (s *SpecializationService) CreateSpecialization(ctx context.Context, degreeID uuid.UUID, req dto.CreateSpecializationRequest) (*models.Specialization, error) {
	user, err := GetUserFromContext(ctx)
	if err != nil {
		return nil, &utils.AppError{Code: 403, Message: "Forbidden: " + err.Error()}
	}

	// Business Rule: A Specialization must belong to an existing, active Degree.
	degree, err := s.degreeRepo.GetDegreeByID(ctx, degreeID, false) // `false` -> only active
	if err != nil {
		return nil, &utils.AppError{Code: 404, Message: "Active degree not found"}
	}

	// RBAC Enforcement: Validate access via degree -> department hierarchy
	if err := s.validateDegreeAccess(ctx, user, degree); err != nil {
		return nil, err
	}

	specialization := &models.Specialization{
		DegreeID: degreeID,
		Name:     req.Name,
		Code:     req.Code,
	}

	createdSpecialization, err := s.specializationRepo.CreateSpecialization(ctx, specialization)
	if err != nil {
		// Handle potential unique constraint violation
		return nil, &utils.AppError{Code: 409, Message: "Conflict: " + err.Error()}
	}

	auditLog := utils.PrepareAuditLog(ctx, "specialization.create", "specialization", createdSpecialization.ID.String(), nil, createdSpecialization)
	s.auditRepo.CreateAuditLog(ctx, auditLog)

	return createdSpecialization, nil
}

// GetSpecialization retrieves a single specialization by its ID.
func (s *SpecializationService) GetSpecialization(ctx context.Context, id uuid.UUID, includeInactive bool) (*models.Specialization, error) {
	specialization, err := s.specializationRepo.GetSpecializationByID(ctx, id, includeInactive)
	if err != nil {
		return nil, &utils.AppError{Code: 404, Message: "Specialization not found"}
	}
	return specialization, nil
}

// ListSpecializationsByDegree retrieves all specializations for a given degree.
func (s *SpecializationService) ListSpecializationsByDegree(ctx context.Context, degreeID uuid.UUID, includeInactive bool) ([]models.Specialization, error) {
	// Ensure degree exists before listing its specializations.
	if _, err := s.degreeRepo.GetDegreeByID(ctx, degreeID, true); err != nil {
		return nil, &utils.AppError{Code: 404, Message: "Degree not found"}
	}
	return s.specializationRepo.ListSpecializationsByDegree(ctx, degreeID, includeInactive)
}

// UpdateSpecialization handles updating a specialization's details, enforcing RBAC.
func (s *SpecializationService) UpdateSpecialization(ctx context.Context, id uuid.UUID, req dto.UpdateSpecializationRequest) (*models.Specialization, error) {
	user, err := GetUserFromContext(ctx)
	if err != nil {
		return nil, &utils.AppError{Code: 403, Message: "Forbidden: " + err.Error()}
	}

	specialization, err := s.specializationRepo.GetSpecializationByID(ctx, id, true) // Get even if inactive
	if err != nil {
		return nil, &utils.AppError{Code: 404, Message: "Specialization not found"}
	}
	oldSpecializationState := *specialization

	// Fetch degree for RBAC validation
	degree, err := s.degreeRepo.GetDegreeByID(ctx, specialization.DegreeID, true)
	if err != nil {
		return nil, &utils.AppError{Code: 404, Message: "Degree not found"}
	}

	// RBAC Enforcement
	if err := s.validateDegreeAccess(ctx, user, degree); err != nil {
		return nil, err
	}

	// Apply updates
	if req.Name != nil {
		specialization.Name = *req.Name
	}
	if req.Code != nil {
		specialization.Code = *req.Code
	}

	updatedSpecialization, err := s.specializationRepo.UpdateSpecialization(ctx, specialization)
	if err != nil {
		return nil, &utils.AppError{Code: 409, Message: "Conflict: " + err.Error()}
	}

	auditLog := utils.PrepareAuditLog(ctx, "specialization.update", "specialization", updatedSpecialization.ID.String(), oldSpecializationState, updatedSpecialization)
	s.auditRepo.CreateAuditLog(ctx, auditLog)

	return updatedSpecialization, nil
}

// DeleteSpecialization handles soft-deleting a specialization, enforcing RBAC.
func (s *SpecializationService) DeleteSpecialization(ctx context.Context, id uuid.UUID) error {
	user, err := GetUserFromContext(ctx)
	if err != nil {
		return &utils.AppError{Code: 403, Message: "Forbidden: " + err.Error()}
	}

	specialization, err := s.specializationRepo.GetSpecializationByID(ctx, id, true)
	if err != nil {
		return &utils.AppError{Code: 404, Message: "Specialization not found"}
	}
	oldSpecializationState := *specialization

	// Fetch degree for RBAC validation
	degree, err := s.degreeRepo.GetDegreeByID(ctx, specialization.DegreeID, true)
	if err != nil {
		return &utils.AppError{Code: 404, Message: "Degree not found"}
	}

	// RBAC Enforcement
	if err := s.validateDegreeAccess(ctx, user, degree); err != nil {
		return err
	}

	if err := s.specializationRepo.DeleteSpecialization(ctx, id); err != nil {
		return &utils.AppError{Code: 500, Message: "Failed to delete specialization: " + err.Error()}
	}

	newSpecializationState := oldSpecializationState
	newSpecializationState.IsActive = false
	auditLog := utils.PrepareAuditLog(ctx, "specialization.delete", "specialization", id.String(), oldSpecializationState, newSpecializationState)
	s.auditRepo.CreateAuditLog(ctx, auditLog)

	return nil
}

// validateDegreeAccess checks if the user has access to manage resources under the given degree.
// This traverses the hierarchy: degree -> department -> faculty
func (s *SpecializationService) validateDegreeAccess(ctx context.Context, user *AuthUser, degree *models.Degree) error {
	// Fetch department to validate access
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
		return &utils.AppError{Code: 403, Message: "Forbidden: User is not authorized to manage specializations in this degree"}
	}

	return nil
}
