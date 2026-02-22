package service

import (
	"github.com/google/uuid"
	"github.com/gradeloop/academic-service/internal/client"
	"github.com/gradeloop/academic-service/internal/domain"
	"github.com/gradeloop/academic-service/internal/dto"
	"github.com/gradeloop/academic-service/internal/repository"
	"github.com/gradeloop/academic-service/internal/utils"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// DepartmentService defines the interface for department business logic
type DepartmentService interface {
	CreateDepartment(req *dto.CreateDepartmentRequest, userID uint, email, ipAddress, userAgent string) (*domain.Department, error)
	UpdateDepartment(id uuid.UUID, req *dto.UpdateDepartmentRequest, userID uint, email, ipAddress, userAgent string) (*domain.Department, error)
	DeactivateDepartment(id uuid.UUID, userID uint, email, ipAddress, userAgent string) error
	GetDepartmentByID(id uuid.UUID) (*domain.Department, error)
	ListDepartments(includeInactive bool) ([]domain.Department, error)
	ListDepartmentsByFaculty(facultyID uuid.UUID, includeInactive bool) ([]domain.Department, error)
}

// departmentService is the concrete implementation
type departmentService struct {
	db             *gorm.DB
	departmentRepo repository.DepartmentRepository
	facultyRepo    repository.FacultyRepository
	auditClient    *client.AuditClient
	logger         *zap.Logger
}

// NewDepartmentService creates a new department service
func NewDepartmentService(
	db *gorm.DB,
	departmentRepo repository.DepartmentRepository,
	facultyRepo repository.FacultyRepository,
	auditClient *client.AuditClient,
	logger *zap.Logger,
) DepartmentService {
	return &departmentService{
		db:             db,
		departmentRepo: departmentRepo,
		facultyRepo:    facultyRepo,
		auditClient:    auditClient,
		logger:         logger,
	}
}

// CreateDepartment creates a new department
func (s *departmentService) CreateDepartment(
	req *dto.CreateDepartmentRequest,
	userID uint,
	email, ipAddress, userAgent string,
) (*domain.Department, error) {
	// Validate input
	if err := s.validateCreateRequest(req); err != nil {
		return nil, err
	}

	// Verify faculty exists and is not deleted
	faculty, err := s.facultyRepo.GetFacultyByID(req.FacultyID)
	if err != nil {
		s.logger.Error("failed to check faculty", zap.Error(err))
		return nil, utils.ErrInternal("failed to check faculty", err)
	}
	if faculty == nil {
		return nil, utils.ErrNotFound("faculty not found")
	}

	// Check if department code already exists for this faculty
	existing, err := s.departmentRepo.GetDepartmentByCodeAndFaculty(req.Code, req.FacultyID)
	if err != nil {
		s.logger.Error("failed to check department code", zap.Error(err))
		return nil, utils.ErrInternal("failed to check department code", err)
	}
	if existing != nil {
		return nil, utils.ErrConflict("department with this code already exists in this faculty")
	}

	// Create department entity
	department := &domain.Department{
		FacultyID:   req.FacultyID,
		Name:        req.Name,
		Code:        req.Code,
		Description: req.Description,
		IsActive:    true,
	}

	// Create department in database
	if err := s.departmentRepo.CreateDepartment(department); err != nil {
		s.logger.Error("failed to create department", zap.Error(err))
		return nil, utils.ErrInternal("failed to create department", err)
	}

	// Log audit event
	changes := map[string]interface{}{
		"faculty_id":  department.FacultyID.String(),
		"name":        department.Name,
		"code":        department.Code,
		"description": department.Description,
	}

	metadata := map[string]interface{}{
		"faculty_name": faculty.Name,
		"faculty_code": faculty.Code,
	}

	if auditErr := s.auditClient.LogDepartmentAction(
		client.AuditActionDepartmentCreated,
		department.ID,
		userID,
		email,
		changes,
		metadata,
		ipAddress,
		userAgent,
	); auditErr != nil {
		s.logger.Warn("failed to log audit event", zap.Error(auditErr))
	}

	s.logger.Info("department created successfully",
		zap.String("department_id", department.ID.String()),
		zap.String("code", department.Code),
		zap.String("faculty_id", department.FacultyID.String()),
	)

	// Reload with faculty relationship
	department, err = s.departmentRepo.GetDepartmentByID(department.ID)
	if err != nil {
		s.logger.Error("failed to reload department", zap.Error(err))
		return nil, utils.ErrInternal("failed to reload department", err)
	}

	return department, nil
}

// UpdateDepartment updates an existing department
func (s *departmentService) UpdateDepartment(
	id uuid.UUID,
	req *dto.UpdateDepartmentRequest,
	userID uint,
	email, ipAddress, userAgent string,
) (*domain.Department, error) {
	// Validate input
	if err := s.validateUpdateRequest(req); err != nil {
		return nil, err
	}

	// Load existing department
	department, err := s.departmentRepo.GetDepartmentByID(id)
	if err != nil {
		s.logger.Error("failed to load department", zap.Error(err))
		return nil, utils.ErrInternal("failed to load department", err)
	}
	if department == nil {
		return nil, utils.ErrNotFound("department not found")
	}

	// Track changes for audit log
	changes := make(map[string]interface{})

	// Update department fields
	if req.Name != "" && req.Name != department.Name {
		changes["name"] = map[string]interface{}{
			"old": department.Name,
			"new": req.Name,
		}
		department.Name = req.Name
	}

	if req.Code != "" && req.Code != department.Code {
		// Check if new code already exists for this faculty
		existing, err := s.departmentRepo.GetDepartmentByCodeAndFaculty(req.Code, department.FacultyID)
		if err != nil {
			s.logger.Error("failed to check department code", zap.Error(err))
			return nil, utils.ErrInternal("failed to check department code", err)
		}
		if existing != nil && existing.ID != department.ID {
			return nil, utils.ErrConflict("department with this code already exists in this faculty")
		}

		changes["code"] = map[string]interface{}{
			"old": department.Code,
			"new": req.Code,
		}
		department.Code = req.Code
	}

	if req.Description != department.Description {
		changes["description"] = map[string]interface{}{
			"old": department.Description,
			"new": req.Description,
		}
		department.Description = req.Description
	}

	if req.IsActive != nil && *req.IsActive != department.IsActive {
		changes["is_active"] = map[string]interface{}{
			"old": department.IsActive,
			"new": *req.IsActive,
		}
		department.IsActive = *req.IsActive
	}

	// Update department
	if err := s.departmentRepo.UpdateDepartment(department); err != nil {
		s.logger.Error("failed to update department", zap.Error(err))
		return nil, utils.ErrInternal("failed to update department", err)
	}

	// Log audit event
	metadata := map[string]interface{}{
		"department_id": department.ID.String(),
		"faculty_id":    department.FacultyID.String(),
	}

	if auditErr := s.auditClient.LogDepartmentAction(
		client.AuditActionDepartmentUpdated,
		department.ID,
		userID,
		email,
		changes,
		metadata,
		ipAddress,
		userAgent,
	); auditErr != nil {
		s.logger.Warn("failed to log audit event", zap.Error(auditErr))
	}

	s.logger.Info("department updated successfully",
		zap.String("department_id", department.ID.String()),
	)

	// Reload with faculty relationship
	department, err = s.departmentRepo.GetDepartmentByID(id)
	if err != nil {
		s.logger.Error("failed to reload department", zap.Error(err))
		return nil, utils.ErrInternal("failed to reload department", err)
	}

	return department, nil
}

// DeactivateDepartment deactivates a department
func (s *departmentService) DeactivateDepartment(
	id uuid.UUID,
	userID uint,
	email, ipAddress, userAgent string,
) error {
	// Load existing department
	department, err := s.departmentRepo.GetDepartmentByID(id)
	if err != nil {
		s.logger.Error("failed to load department", zap.Error(err))
		return utils.ErrInternal("failed to load department", err)
	}
	if department == nil {
		return utils.ErrNotFound("department not found")
	}

	// Update is_active to false
	department.IsActive = false

	if err := s.departmentRepo.UpdateDepartment(department); err != nil {
		s.logger.Error("failed to deactivate department", zap.Error(err))
		return utils.ErrInternal("failed to deactivate department", err)
	}

	// Log audit event
	changes := map[string]interface{}{
		"is_active": map[string]interface{}{
			"old": true,
			"new": false,
		},
	}

	metadata := map[string]interface{}{
		"faculty_id": department.FacultyID.String(),
	}

	if auditErr := s.auditClient.LogDepartmentAction(
		client.AuditActionDepartmentDeactivated,
		department.ID,
		userID,
		email,
		changes,
		metadata,
		ipAddress,
		userAgent,
	); auditErr != nil {
		s.logger.Warn("failed to log audit event", zap.Error(auditErr))
	}

	s.logger.Info("department deactivated successfully",
		zap.String("department_id", department.ID.String()),
	)

	return nil
}

// GetDepartmentByID retrieves a department by ID
func (s *departmentService) GetDepartmentByID(id uuid.UUID) (*domain.Department, error) {
	department, err := s.departmentRepo.GetDepartmentByID(id)
	if err != nil {
		s.logger.Error("failed to get department", zap.Error(err))
		return nil, utils.ErrInternal("failed to get department", err)
	}
	if department == nil {
		return nil, utils.ErrNotFound("department not found")
	}

	return department, nil
}

// ListDepartments retrieves all departments
func (s *departmentService) ListDepartments(includeInactive bool) ([]domain.Department, error) {
	departments, err := s.departmentRepo.ListDepartments(includeInactive)
	if err != nil {
		s.logger.Error("failed to list departments", zap.Error(err))
		return nil, utils.ErrInternal("failed to list departments", err)
	}

	return departments, nil
}

// ListDepartmentsByFaculty retrieves all departments for a specific faculty
// Returns departments with is_active=false if faculty is inactive (Option B)
func (s *departmentService) ListDepartmentsByFaculty(facultyID uuid.UUID, includeInactive bool) ([]domain.Department, error) {
	// Check if faculty exists
	faculty, err := s.facultyRepo.GetFacultyByID(facultyID)
	if err != nil {
		s.logger.Error("failed to check faculty", zap.Error(err))
		return nil, utils.ErrInternal("failed to check faculty", err)
	}
	if faculty == nil {
		return nil, utils.ErrNotFound("faculty not found")
	}

	// If faculty is inactive and includeInactive is false, return only inactive departments
	// This implements Option B: return departments with is_active=false
	if !faculty.IsActive && !includeInactive {
		// Return all departments for the faculty but they should all be inactive
		departments, err := s.departmentRepo.ListDepartmentsByFaculty(facultyID, true)
		if err != nil {
			s.logger.Error("failed to list departments", zap.Error(err))
			return nil, utils.ErrInternal("failed to list departments", err)
		}
		return departments, nil
	}

	// Normal case: get departments based on includeInactive flag
	departments, err := s.departmentRepo.ListDepartmentsByFaculty(facultyID, includeInactive)
	if err != nil {
		s.logger.Error("failed to list departments by faculty", zap.Error(err))
		return nil, utils.ErrInternal("failed to list departments by faculty", err)
	}

	return departments, nil
}

// validateCreateRequest validates the create department request
func (s *departmentService) validateCreateRequest(req *dto.CreateDepartmentRequest) error {
	if req.FacultyID == uuid.Nil {
		return utils.ErrBadRequest("faculty_id is required")
	}

	if req.Name == "" {
		return utils.ErrBadRequest("name is required")
	}
	if len(req.Name) < 3 || len(req.Name) > 255 {
		return utils.ErrBadRequest("name must be between 3 and 255 characters")
	}

	if req.Code == "" {
		return utils.ErrBadRequest("code is required")
	}
	if len(req.Code) < 2 || len(req.Code) > 50 {
		return utils.ErrBadRequest("code must be between 2 and 50 characters")
	}

	return nil
}

// validateUpdateRequest validates the update department request
func (s *departmentService) validateUpdateRequest(req *dto.UpdateDepartmentRequest) error {
	if req.Name != "" && (len(req.Name) < 3 || len(req.Name) > 255) {
		return utils.ErrBadRequest("name must be between 3 and 255 characters")
	}

	if req.Code != "" && (len(req.Code) < 2 || len(req.Code) > 50) {
		return utils.ErrBadRequest("code must be between 2 and 50 characters")
	}

	return nil
}
