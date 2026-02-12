package usecases

import (
	"context"
	"errors"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/dto"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/ports"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/utils"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
	"github.com/google/uuid"
)

// AuthUser represents the authenticated user's data, typically from a JWT.
type AuthUser struct {
	UserID    uuid.UUID
	Roles     []string
	FacultyID *uuid.UUID
}

// GetUserFromContext is a helper to extract user information from the request context.
// In a real-world scenario, this data would be populated by an authentication middleware
// after validating a JWT.
func GetUserFromContext(ctx context.Context) (*AuthUser, error) {
	userIDVal := ctx.Value("user_id")
	rolesVal := ctx.Value("roles")
	facultyIDVal := ctx.Value("faculty_id")

	var user AuthUser

	if userIDStr, ok := userIDVal.(string); ok && userIDStr != "" {
		uid, err := uuid.Parse(userIDStr)
		if err != nil {
			return nil, errors.New("invalid user_id in context")
		}
		user.UserID = uid
	} else {
		return nil, errors.New("user_id not found in context or is empty")
	}

	if roles, ok := rolesVal.([]string); ok {
		user.Roles = roles
	} else {
		user.Roles = []string{} // Default to no roles
	}

	if facultyIDStr, ok := facultyIDVal.(string); ok && facultyIDStr != "" {
		fid, err := uuid.Parse(facultyIDStr)
		if err != nil {
			return nil, errors.New("invalid faculty_id in context")
		}
		user.FacultyID = &fid
	}

	return &user, nil
}

// HasRole checks if a user has a specific role.
func (u *AuthUser) HasRole(role string) bool {
	for _, r := range u.Roles {
		if r == role {
			return true
		}
	}
	return false
}

// DepartmentService handles the business logic for department management.
type DepartmentService struct {
	deptRepo    ports.DepartmentRepository
	facultyRepo ports.FacultyRepository
	auditRepo   ports.AuditRepository
}

// NewDepartmentService creates a new DepartmentService.
func NewDepartmentService(deptRepo ports.DepartmentRepository, facultyRepo ports.FacultyRepository, auditRepo ports.AuditRepository) *DepartmentService {
	return &DepartmentService{
		deptRepo:    deptRepo,
		facultyRepo: facultyRepo,
		auditRepo:   auditRepo,
	}
}

// CreateDepartment handles creating a new department, enforcing business rules and RBAC.
func (s *DepartmentService) CreateDepartment(ctx context.Context, facultyID uuid.UUID, req dto.CreateDepartmentRequest) (*models.Department, error) {
	user, err := GetUserFromContext(ctx)
	if err != nil {
		return nil, &utils.AppError{Code: 403, Message: "Forbidden: " + err.Error()}
	}

	// Business Rule: A Department must belong to an existing, active Faculty.
	faculty, err := s.facultyRepo.GetFacultyByID(ctx, facultyID, false) // `false` -> only active
	if err != nil {
		return nil, &utils.AppError{Code: 404, Message: "Active faculty not found"}
	}

	// RBAC Enforcement
	isSuperAdmin := user.HasRole("super_admin")
	isFacultyAdmin := user.HasRole("faculty_admin") && user.FacultyID != nil && *user.FacultyID == faculty.ID

	if !isSuperAdmin && !isFacultyAdmin {
		return nil, &utils.AppError{Code: 403, Message: "Forbidden: User is not authorized to create a department in this faculty"}
	}

	dept := &models.Department{
		FacultyID:   facultyID,
		Name:        req.Name,
		Code:        req.Code,
		Description: req.Description,
	}

	createdDept, err := s.deptRepo.CreateDepartment(ctx, dept)
	if err != nil {
		// Handle potential unique constraint violation
		return nil, &utils.AppError{Code: 409, Message: "Conflict: " + err.Error()}
	}

	auditLog := utils.PrepareAuditLog(ctx, "department.create", "department", createdDept.ID.String(), nil, createdDept)
	s.auditRepo.CreateAuditLog(ctx, auditLog)

	return createdDept, nil
}

// GetDepartment retrieves a single department by its ID.
func (s *DepartmentService) GetDepartment(ctx context.Context, id uuid.UUID, includeInactive bool) (*models.Department, error) {
	dept, err := s.deptRepo.GetDepartmentByID(ctx, id, includeInactive)
	if err != nil {
		return nil, &utils.AppError{Code: 404, Message: "Department not found"}
	}
	return dept, nil
}

// ListDepartmentsByFaculty retrieves all departments for a given faculty.
func (s *DepartmentService) ListDepartmentsByFaculty(ctx context.Context, facultyID uuid.UUID, includeInactive bool) ([]models.Department, error) {
	// Ensure faculty exists before listing its departments.
	if _, err := s.facultyRepo.GetFacultyByID(ctx, facultyID, true); err != nil {
		return nil, &utils.AppError{Code: 404, Message: "Faculty not found"}
	}
	return s.deptRepo.ListDepartmentsByFaculty(ctx, facultyID, includeInactive)
}

// UpdateDepartment handles updating a department's details, enforcing RBAC.
func (s *DepartmentService) UpdateDepartment(ctx context.Context, id uuid.UUID, req dto.UpdateDepartmentRequest) (*models.Department, error) {
	user, err := GetUserFromContext(ctx)
	if err != nil {
		return nil, &utils.AppError{Code: 403, Message: "Forbidden: " + err.Error()}
	}

	dept, err := s.deptRepo.GetDepartmentByID(ctx, id, true) // Get even if inactive
	if err != nil {
		return nil, &utils.AppError{Code: 404, Message: "Department not found"}
	}
	oldDeptState := *dept

	// RBAC Enforcement
	isSuperAdmin := user.HasRole("super_admin")
	isFacultyAdmin := user.HasRole("faculty_admin") && user.FacultyID != nil && *user.FacultyID == dept.FacultyID

	if !isSuperAdmin && !isFacultyAdmin {
		return nil, &utils.AppError{Code: 403, Message: "Forbidden: User is not authorized to update this department"}
	}

	// Apply updates
	if req.Name != nil {
		dept.Name = *req.Name
	}
	if req.Code != nil {
		dept.Code = *req.Code
	}
	if req.Description != nil {
		dept.Description = *req.Description
	}

	updatedDept, err := s.deptRepo.UpdateDepartment(ctx, dept)
	if err != nil {
		return nil, &utils.AppError{Code: 409, Message: "Conflict: " + err.Error()}
	}

	auditLog := utils.PrepareAuditLog(ctx, "department.update", "department", updatedDept.ID.String(), oldDeptState, updatedDept)
	s.auditRepo.CreateAuditLog(ctx, auditLog)

	return updatedDept, nil
}

// DeleteDepartment handles soft-deleting a department, enforcing RBAC.
func (s *DepartmentService) DeleteDepartment(ctx context.Context, id uuid.UUID) error {
	user, err := GetUserFromContext(ctx)
	if err != nil {
		return &utils.AppError{Code: 403, Message: "Forbidden: " + err.Error()}
	}

	dept, err := s.deptRepo.GetDepartmentByID(ctx, id, true)
	if err != nil {
		return &utils.AppError{Code: 404, Message: "Department not found"}
	}
	oldDeptState := *dept

	// RBAC Enforcement
	isSuperAdmin := user.HasRole("super_admin")
	isFacultyAdmin := user.HasRole("faculty_admin") && user.FacultyID != nil && *user.FacultyID == dept.FacultyID

	if !isSuperAdmin && !isFacultyAdmin {
		return &utils.AppError{Code: 403, Message: "Forbidden: User is not authorized to delete this department"}
	}

	if err := s.deptRepo.DeleteDepartment(ctx, id); err != nil {
		return &utils.AppError{Code: 500, Message: "Failed to delete department: " + err.Error()}
	}

	newDeptState := oldDeptState
	newDeptState.IsActive = false
	auditLog := utils.PrepareAuditLog(ctx, "department.delete", "department", id.String(), oldDeptState, newDeptState)
	s.auditRepo.CreateAuditLog(ctx, auditLog)

	return nil
}
