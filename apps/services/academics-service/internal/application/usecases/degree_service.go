package usecases

import (
	"context"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/dto"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/ports"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/utils"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
	"github.com/google/uuid"
)

// DegreeService handles the business logic for degree management.
type DegreeService struct {
	degreeRepo         ports.DegreeRepository
	departmentRepo     ports.DepartmentRepository
	specializationRepo ports.SpecializationRepository
	auditRepo          ports.AuditRepository
}

// NewDegreeService creates a new DegreeService.
func NewDegreeService(
	degreeRepo ports.DegreeRepository,
	departmentRepo ports.DepartmentRepository,
	specializationRepo ports.SpecializationRepository,
	auditRepo ports.AuditRepository,
) *DegreeService {
	return &DegreeService{
		degreeRepo:         degreeRepo,
		departmentRepo:     departmentRepo,
		specializationRepo: specializationRepo,
		auditRepo:          auditRepo,
	}
}

// CreateDegree handles creating a new degree, enforcing business rules and RBAC.
func (s *DegreeService) CreateDegree(ctx context.Context, departmentID uuid.UUID, req dto.CreateDegreeRequest) (*models.Degree, error) {
	user, err := GetUserFromContext(ctx)
	if err != nil {
		return nil, &utils.AppError{Code: 403, Message: "Forbidden: " + err.Error()}
	}

	// Business Rule: A Degree must belong to an existing, active Department.
	department, err := s.departmentRepo.GetDepartmentByID(ctx, departmentID, false) // `false` -> only active
	if err != nil {
		return nil, &utils.AppError{Code: 404, Message: "Active department not found"}
	}

	// RBAC Enforcement: Validate access to this department
	if err := s.validateDepartmentAccess(ctx, user, department); err != nil {
		return nil, err
	}

	degree := &models.Degree{
		DepartmentID: departmentID,
		Name:         req.Name,
		Code:         req.Code,
		Level:        req.Level,
	}

	createdDegree, err := s.degreeRepo.CreateDegree(ctx, degree)
	if err != nil {
		// Handle potential unique constraint violation
		return nil, &utils.AppError{Code: 409, Message: "Conflict: " + err.Error()}
	}

	auditLog := utils.PrepareAuditLog(ctx, "degree.create", "degree", createdDegree.ID.String(), nil, createdDegree)
	s.auditRepo.CreateAuditLog(ctx, auditLog)

	return createdDegree, nil
}

// GetDegree retrieves a single degree by its ID.
func (s *DegreeService) GetDegree(ctx context.Context, id uuid.UUID, includeInactive bool) (*models.Degree, error) {
	degree, err := s.degreeRepo.GetDegreeByID(ctx, id, includeInactive)
	if err != nil {
		return nil, &utils.AppError{Code: 404, Message: "Degree not found"}
	}
	return degree, nil
}

// ListDegreesByDepartment retrieves all degrees for a given department.
func (s *DegreeService) ListDegreesByDepartment(ctx context.Context, departmentID uuid.UUID, includeInactive bool) ([]models.Degree, error) {
	// Ensure department exists before listing its degrees.
	if _, err := s.departmentRepo.GetDepartmentByID(ctx, departmentID, true); err != nil {
		return nil, &utils.AppError{Code: 404, Message: "Department not found"}
	}
	return s.degreeRepo.ListDegreesByDepartment(ctx, departmentID, includeInactive)
}

// UpdateDegree handles updating a degree's details, enforcing RBAC.
func (s *DegreeService) UpdateDegree(ctx context.Context, id uuid.UUID, req dto.UpdateDegreeRequest) (*models.Degree, error) {
	user, err := GetUserFromContext(ctx)
	if err != nil {
		return nil, &utils.AppError{Code: 403, Message: "Forbidden: " + err.Error()}
	}

	degree, err := s.degreeRepo.GetDegreeByID(ctx, id, true) // Get even if inactive
	if err != nil {
		return nil, &utils.AppError{Code: 404, Message: "Degree not found"}
	}
	oldDegreeState := *degree

	// Fetch department for RBAC validation
	department, err := s.departmentRepo.GetDepartmentByID(ctx, degree.DepartmentID, true)
	if err != nil {
		return nil, &utils.AppError{Code: 404, Message: "Department not found"}
	}

	// RBAC Enforcement
	if err := s.validateDepartmentAccess(ctx, user, department); err != nil {
		return nil, err
	}

	// Apply updates
	if req.Name != nil {
		degree.Name = *req.Name
	}
	if req.Code != nil {
		degree.Code = *req.Code
	}
	if req.Level != nil {
		degree.Level = *req.Level
	}

	updatedDegree, err := s.degreeRepo.UpdateDegree(ctx, degree)
	if err != nil {
		return nil, &utils.AppError{Code: 409, Message: "Conflict: " + err.Error()}
	}

	auditLog := utils.PrepareAuditLog(ctx, "degree.update", "degree", updatedDegree.ID.String(), oldDegreeState, updatedDegree)
	s.auditRepo.CreateAuditLog(ctx, auditLog)

	return updatedDegree, nil
}

// DeleteDegree handles soft-deleting a degree with cascade to specializations, enforcing RBAC.
func (s *DegreeService) DeleteDegree(ctx context.Context, id uuid.UUID) error {
	user, err := GetUserFromContext(ctx)
	if err != nil {
		return &utils.AppError{Code: 403, Message: "Forbidden: " + err.Error()}
	}

	degree, err := s.degreeRepo.GetDegreeByID(ctx, id, true)
	if err != nil {
		return &utils.AppError{Code: 404, Message: "Degree not found"}
	}
	oldDegreeState := *degree

	// Fetch department for RBAC validation
	department, err := s.departmentRepo.GetDepartmentByID(ctx, degree.DepartmentID, true)
	if err != nil {
		return &utils.AppError{Code: 404, Message: "Department not found"}
	}

	// RBAC Enforcement
	if err := s.validateDepartmentAccess(ctx, user, department); err != nil {
		return err
	}

	// Cascade soft-delete: Deactivate all active specializations first
	specializations, err := s.specializationRepo.ListSpecializationsByDegree(ctx, id, false) // Only active
	if err != nil {
		return &utils.AppError{Code: 500, Message: "Failed to fetch specializations: " + err.Error()}
	}

	// Deactivate each specialization with individual audit logs
	for _, spec := range specializations {
		oldSpecState := spec
		if err := s.specializationRepo.DeleteSpecialization(ctx, spec.ID); err != nil {
			return &utils.AppError{Code: 500, Message: "Failed to deactivate specialization: " + err.Error()}
		}
		newSpecState := oldSpecState
		newSpecState.IsActive = false
		auditLog := utils.PrepareAuditLog(ctx, "specialization.cascade_delete", "specialization", spec.ID.String(), oldSpecState, newSpecState)
		s.auditRepo.CreateAuditLog(ctx, auditLog)
	}

	// Now deactivate the degree
	if err := s.degreeRepo.DeleteDegree(ctx, id); err != nil {
		return &utils.AppError{Code: 500, Message: "Failed to delete degree: " + err.Error()}
	}

	newDegreeState := oldDegreeState
	newDegreeState.IsActive = false
	auditLog := utils.PrepareAuditLog(ctx, "degree.delete", "degree", id.String(), oldDegreeState, newDegreeState)
	s.auditRepo.CreateAuditLog(ctx, auditLog)

	return nil
}

// validateDepartmentAccess checks if the user has access to manage resources in the given department.
func (s *DegreeService) validateDepartmentAccess(ctx context.Context, user *AuthUser, department *models.Department) error {
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
		return &utils.AppError{Code: 403, Message: "Forbidden: User is not authorized to manage degrees in this department"}
	}

	return nil
}
