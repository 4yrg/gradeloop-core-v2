package service

import (
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academic/internal/client"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academic/internal/domain"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academic/internal/dto"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academic/internal/repository"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academic/internal/utils"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// DegreeService defines the interface for degree business logic
type DegreeService interface {
	CreateDegree(req *dto.CreateDegreeRequest, userID uint, email, ipAddress, userAgent string) (*domain.Degree, error)
	UpdateDegree(id uuid.UUID, req *dto.UpdateDegreeRequest, userID uint, email, ipAddress, userAgent string) (*domain.Degree, error)
	DeactivateDegree(id uuid.UUID, userID uint, email, ipAddress, userAgent string) error
	GetDegreeByID(id uuid.UUID) (*domain.Degree, error)
	ListDegrees(includeInactive bool) ([]domain.Degree, error)
	ListDegreesByDepartment(departmentID uuid.UUID, includeInactive bool) ([]domain.Degree, error)

	CreateSpecialization(req *dto.CreateSpecializationRequest, userID uint, email, ipAddress, userAgent string) (*domain.Specialization, error)
	UpdateSpecialization(id uuid.UUID, req *dto.UpdateSpecializationRequest, userID uint, email, ipAddress, userAgent string) (*domain.Specialization, error)
	DeactivateSpecialization(id uuid.UUID, userID uint, email, ipAddress, userAgent string) error
	GetSpecializationByID(id uuid.UUID) (*domain.Specialization, error)
	ListSpecializationsByDegree(degreeID uuid.UUID, includeInactive bool) ([]domain.Specialization, error)
}

// degreeService is the concrete implementation
type degreeService struct {
	db                     *gorm.DB
	degreeRepo             repository.DegreeRepository
	specializationRepo     repository.SpecializationRepository
	departmentRepo         repository.DepartmentRepository
	auditClient            *client.AuditClient
	logger                 *zap.Logger
	allowedDegreeLevelVals map[string]struct{}
}

// NewDegreeService creates a new degree service
func NewDegreeService(
	db *gorm.DB,
	degreeRepo repository.DegreeRepository,
	specializationRepo repository.SpecializationRepository,
	departmentRepo repository.DepartmentRepository,
	auditClient *client.AuditClient,
	logger *zap.Logger,
) DegreeService {
	allowed := map[string]struct{}{
		"Undergraduate": {},
		"Postgraduate":  {},
		"Doctoral":      {},
		"Diploma":       {},
		"Certificate":   {},
	}

	return &degreeService{
		db:                     db,
		degreeRepo:             degreeRepo,
		specializationRepo:     specializationRepo,
		departmentRepo:         departmentRepo,
		auditClient:            auditClient,
		logger:                 logger,
		allowedDegreeLevelVals: allowed,
	}
}

// CreateDegree creates a new degree
func (s *degreeService) CreateDegree(
	req *dto.CreateDegreeRequest,
	userID uint,
	email, ipAddress, userAgent string,
) (*domain.Degree, error) {
	// Validate input
	if err := s.validateCreateDegreeRequest(req); err != nil {
		return nil, err
	}

	// Verify department exists and not deleted
	dept, err := s.departmentRepo.GetDepartmentByID(req.DepartmentID)
	if err != nil {
		s.logger.Error("failed to check department", zap.Error(err))
		return nil, utils.ErrInternal("failed to check department", err)
	}
	if dept == nil {
		return nil, utils.ErrNotFound("department not found")
	}
	// Department must be active
	if !dept.IsActive {
		return nil, utils.ErrBadRequest("department is inactive")
	}

	// Check unique (department_id, code)
	existingList, err := s.degreeRepo.ListDegreesByDepartment(req.DepartmentID, true)
	if err != nil {
		s.logger.Error("failed to check existing degrees", zap.Error(err))
		return nil, utils.ErrInternal("failed to check existing degrees", err)
	}
	for _, d := range existingList {
		if d.Code == req.Code && d.DeletedAt == nil {
			return nil, utils.ErrConflict("degree with this code already exists in this department")
		}
	}

	degree := &domain.Degree{
		ID:           uuid.New(),
		DepartmentID: req.DepartmentID,
		Name:         req.Name,
		Code:         req.Code,
		Level:        req.Level,
		IsActive:     true,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := s.degreeRepo.CreateDegree(degree); err != nil {
		s.logger.Error("failed to create degree", zap.Error(err))
		return nil, utils.ErrInternal("failed to create degree", err)
	}

	// Audit log
	changes := map[string]interface{}{
		"department_id": degree.DepartmentID.String(),
		"name":          degree.Name,
		"code":          degree.Code,
		"level":         degree.Level,
	}
	metadata := map[string]interface{}{
		"department_name": dept.Name,
		"department_code": dept.Code,
	}
	if auditErr := s.auditClient.LogDegreeAction(client.AuditActionDegreeCreated, degree.ID, userID, email, changes, metadata, ipAddress, userAgent); auditErr != nil {
		s.logger.Warn("failed to log audit event", zap.Error(auditErr))
	}

	// Reload degree
	loaded, err := s.degreeRepo.GetDegreeByID(degree.ID)
	if err != nil {
		s.logger.Error("failed to reload degree", zap.Error(err))
		return nil, utils.ErrInternal("failed to reload degree", err)
	}

	return loaded, nil
}

// UpdateDegree updates an existing degree
func (s *degreeService) UpdateDegree(
	id uuid.UUID,
	req *dto.UpdateDegreeRequest,
	userID uint,
	email, ipAddress, userAgent string,
) (*domain.Degree, error) {
	// Validate input
	if err := s.validateUpdateDegreeRequest(req); err != nil {
		return nil, err
	}

	degree, err := s.degreeRepo.GetDegreeByID(id)
	if err != nil {
		s.logger.Error("failed to load degree", zap.Error(err))
		return nil, utils.ErrInternal("failed to load degree", err)
	}
	if degree == nil {
		return nil, utils.ErrNotFound("degree not found")
	}

	changes := make(map[string]interface{})

	if req.Name != "" && req.Name != degree.Name {
		changes["name"] = map[string]interface{}{"old": degree.Name, "new": req.Name}
		degree.Name = req.Name
	}

	if req.Code != "" && req.Code != degree.Code {
		// check uniqueness within department using optional helper
		existing, err := s.optionalGetByCodeAndDepartment(req.Code, degree.DepartmentID)
		// If optional helper is not implemented, it returns an error we can safely ignore for uniqueness fallback.
		// If an actual error occurred while checking, log it.
		if err != nil && err.Error() != "not implemented" {
			s.logger.Debug("failed to check degree code uniqueness", zap.Error(err))
		}
		if existing != nil && existing.ID != degree.ID {
			return nil, utils.ErrConflict("degree with this code already exists in this department")
		}
		changes["code"] = map[string]interface{}{"old": degree.Code, "new": req.Code}
		degree.Code = req.Code
	}

	if req.Level != "" && req.Level != degree.Level {
		if _, ok := s.allowedDegreeLevelVals[req.Level]; !ok {
			return nil, utils.ErrBadRequest("invalid level value")
		}
		changes["level"] = map[string]interface{}{"old": degree.Level, "new": req.Level}
		degree.Level = req.Level
	}

	// Handle is_active change
	if req.IsActive != nil && *req.IsActive != degree.IsActive {
		changes["is_active"] = map[string]interface{}{"old": degree.IsActive, "new": *req.IsActive}
		degree.IsActive = *req.IsActive
	}

	degree.UpdatedAt = time.Now()

	if err := s.degreeRepo.UpdateDegree(degree); err != nil {
		s.logger.Error("failed to update degree", zap.Error(err))
		return nil, utils.ErrInternal("failed to update degree", err)
	}

	// If deactivated, cascade deactivate specializations (soft deactivate by setting is_active=false)
	if !degree.IsActive {
		if err := s.specializationRepo.DeactivateByDegreeID(degree.ID); err != nil {
			s.logger.Error("failed to deactivate specializations for degree", zap.Error(err))
			// don't abort the operation; just log
		}
	}

	// Audit
	if auditErr := s.auditClient.LogDegreeAction(client.AuditActionDegreeUpdated, degree.ID, userID, email, changes, nil, ipAddress, userAgent); auditErr != nil {
		s.logger.Warn("failed to log audit event", zap.Error(auditErr))
	}

	// Reload
	loaded, err := s.degreeRepo.GetDegreeByID(degree.ID)
	if err != nil {
		s.logger.Error("failed to reload degree", zap.Error(err))
		return nil, utils.ErrInternal("failed to reload degree", err)
	}

	return loaded, nil
}

// DeactivateDegree deactivates a degree
func (s *degreeService) DeactivateDegree(id uuid.UUID, userID uint, email, ipAddress, userAgent string) error {
	degree, err := s.degreeRepo.GetDegreeByID(id)
	if err != nil {
		s.logger.Error("failed to load degree", zap.Error(err))
		return utils.ErrInternal("failed to load degree", err)
	}
	if degree == nil {
		return utils.ErrNotFound("degree not found")
	}

	if !degree.IsActive {
		// already inactive - no-op
		return nil
	}

	degree.IsActive = false
	degree.UpdatedAt = time.Now()

	if err := s.degreeRepo.UpdateDegree(degree); err != nil {
		s.logger.Error("failed to deactivate degree", zap.Error(err))
		return utils.ErrInternal("failed to deactivate degree", err)
	}

	// Cascade deactivate specializations
	if err := s.specializationRepo.DeactivateByDegreeID(degree.ID); err != nil {
		s.logger.Error("failed to deactivate specializations for degree", zap.Error(err))
		// don't fail the main operation
	}

	changes := map[string]interface{}{
		"is_active": map[string]interface{}{"old": true, "new": false},
	}
	if auditErr := s.auditClient.LogDegreeAction(client.AuditActionDegreeDeactivated, degree.ID, userID, email, changes, nil, ipAddress, userAgent); auditErr != nil {
		s.logger.Warn("failed to log audit event", zap.Error(auditErr))
	}

	return nil
}

// GetDegreeByID retrieves a degree by ID
func (s *degreeService) GetDegreeByID(id uuid.UUID) (*domain.Degree, error) {
	degree, err := s.degreeRepo.GetDegreeByID(id)
	if err != nil {
		s.logger.Error("failed to get degree", zap.Error(err))
		return nil, utils.ErrInternal("failed to get degree", err)
	}
	if degree == nil {
		return nil, utils.ErrNotFound("degree not found")
	}
	return degree, nil
}

// ListDegrees retrieves degrees
func (s *degreeService) ListDegrees(includeInactive bool) ([]domain.Degree, error) {
	degrees, err := s.degreeRepo.ListDegrees(includeInactive)
	if err != nil {
		s.logger.Error("failed to list degrees", zap.Error(err))
		return nil, utils.ErrInternal("failed to list degrees", err)
	}
	return degrees, nil
}

// ListDegreesByDepartment retrieves degrees by department
func (s *degreeService) ListDegreesByDepartment(departmentID uuid.UUID, includeInactive bool) ([]domain.Degree, error) {
	// verify department exists
	dept, err := s.departmentRepo.GetDepartmentByID(departmentID)
	if err != nil {
		s.logger.Error("failed to check department", zap.Error(err))
		return nil, utils.ErrInternal("failed to check department", err)
	}
	if dept == nil {
		return nil, utils.ErrNotFound("department not found")
	}

	// If department inactive and includeInactive == false, return departments' degrees based on policy: we will return degrees but filter as requested
	degrees, err := s.degreeRepo.ListDegreesByDepartment(departmentID, includeInactive)
	if err != nil {
		s.logger.Error("failed to list degrees by department", zap.Error(err))
		return nil, utils.ErrInternal("failed to list degrees by department", err)
	}

	return degrees, nil
}

// --- Specialization methods ---

// CreateSpecialization creates a new specialization
func (s *degreeService) CreateSpecialization(
	req *dto.CreateSpecializationRequest,
	userID uint,
	email, ipAddress, userAgent string,
) (*domain.Specialization, error) {
	// Validate
	if err := s.validateCreateSpecializationRequest(req); err != nil {
		return nil, err
	}

	// Verify parent degree exists and active
	deg, err := s.degreeRepo.GetDegreeByID(req.DegreeID)
	if err != nil {
		s.logger.Error("failed to check degree", zap.Error(err))
		return nil, utils.ErrInternal("failed to check degree", err)
	}
	if deg == nil {
		return nil, utils.ErrNotFound("degree not found")
	}
	if !deg.IsActive {
		return nil, utils.ErrBadRequest("parent degree is inactive")
	}

	// Check uniqueness (degree_id, code)
	existing, err := s.specializationRepo.ListSpecializationsByDegree(req.DegreeID, true)
	if err != nil {
		s.logger.Error("failed to check existing specializations", zap.Error(err))
		return nil, utils.ErrInternal("failed to check existing specializations", err)
	}
	for _, sp := range existing {
		if sp.Code == req.Code && sp.DeletedAt == nil {
			return nil, utils.ErrConflict("specialization with this code already exists in this degree")
		}
	}

	spec := &domain.Specialization{
		ID:        uuid.New(),
		DegreeID:  req.DegreeID,
		Name:      req.Name,
		Code:      req.Code,
		IsActive:  true,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := s.specializationRepo.CreateSpecialization(spec); err != nil {
		s.logger.Error("failed to create specialization", zap.Error(err))
		return nil, utils.ErrInternal("failed to create specialization", err)
	}

	changes := map[string]interface{}{
		"degree_id": spec.DegreeID.String(),
		"name":      spec.Name,
		"code":      spec.Code,
	}
	if auditErr := s.auditClient.LogSpecializationAction(client.AuditActionSpecializationCreated, spec.ID, userID, email, changes, nil, ipAddress, userAgent); auditErr != nil {
		s.logger.Warn("failed to log audit event", zap.Error(auditErr))
	}

	loaded, err := s.specializationRepo.GetSpecializationByID(spec.ID)
	if err != nil {
		s.logger.Error("failed to reload specialization", zap.Error(err))
		return nil, utils.ErrInternal("failed to reload specialization", err)
	}

	return loaded, nil
}

// UpdateSpecialization updates an existing specialization
func (s *degreeService) UpdateSpecialization(
	id uuid.UUID,
	req *dto.UpdateSpecializationRequest,
	userID uint,
	email, ipAddress, userAgent string,
) (*domain.Specialization, error) {
	// Validate
	if err := s.validateUpdateSpecializationRequest(req); err != nil {
		return nil, err
	}

	spec, err := s.specializationRepo.GetSpecializationByID(id)
	if err != nil {
		s.logger.Error("failed to load specialization", zap.Error(err))
		return nil, utils.ErrInternal("failed to load specialization", err)
	}
	if spec == nil {
		return nil, utils.ErrNotFound("specialization not found")
	}

	changes := make(map[string]interface{})

	if req.Name != "" && req.Name != spec.Name {
		changes["name"] = map[string]interface{}{"old": spec.Name, "new": req.Name}
		spec.Name = req.Name
	}

	if req.Code != "" && req.Code != spec.Code {
		// check uniqueness
		existingList, err := s.specializationRepo.ListSpecializationsByDegree(spec.DegreeID, true)
		if err != nil {
			s.logger.Error("failed to check specialization codes", zap.Error(err))
			return nil, utils.ErrInternal("failed to check specialization codes", err)
		}
		for _, existing := range existingList {
			if existing.Code == req.Code && existing.ID != spec.ID && existing.DeletedAt == nil {
				return nil, utils.ErrConflict("specialization with this code already exists in this degree")
			}
		}
		changes["code"] = map[string]interface{}{"old": spec.Code, "new": req.Code}
		spec.Code = req.Code
	}

	if req.IsActive != nil && *req.IsActive != spec.IsActive {
		changes["is_active"] = map[string]interface{}{"old": spec.IsActive, "new": *req.IsActive}
		spec.IsActive = *req.IsActive
	}

	spec.UpdatedAt = time.Now()

	if err := s.specializationRepo.UpdateSpecialization(spec); err != nil {
		s.logger.Error("failed to update specialization", zap.Error(err))
		return nil, utils.ErrInternal("failed to update specialization", err)
	}

	if auditErr := s.auditClient.LogSpecializationAction(client.AuditActionSpecializationUpdated, spec.ID, userID, email, changes, nil, ipAddress, userAgent); auditErr != nil {
		s.logger.Warn("failed to log audit event", zap.Error(auditErr))
	}

	loaded, err := s.specializationRepo.GetSpecializationByID(spec.ID)
	if err != nil {
		s.logger.Error("failed to reload specialization", zap.Error(err))
		return nil, utils.ErrInternal("failed to reload specialization", err)
	}

	return loaded, nil
}

// DeactivateSpecialization deactivates a specialization
func (s *degreeService) DeactivateSpecialization(id uuid.UUID, userID uint, email, ipAddress, userAgent string) error {
	spec, err := s.specializationRepo.GetSpecializationByID(id)
	if err != nil {
		s.logger.Error("failed to load specialization", zap.Error(err))
		return utils.ErrInternal("failed to load specialization", err)
	}
	if spec == nil {
		return utils.ErrNotFound("specialization not found")
	}

	if !spec.IsActive {
		return nil
	}

	spec.IsActive = false
	spec.UpdatedAt = time.Now()

	if err := s.specializationRepo.UpdateSpecialization(spec); err != nil {
		s.logger.Error("failed to deactivate specialization", zap.Error(err))
		return utils.ErrInternal("failed to deactivate specialization", err)
	}

	changes := map[string]interface{}{
		"is_active": map[string]interface{}{"old": true, "new": false},
	}
	if auditErr := s.auditClient.LogSpecializationAction(client.AuditActionSpecializationDeactivated, spec.ID, userID, email, changes, nil, ipAddress, userAgent); auditErr != nil {
		s.logger.Warn("failed to log audit event", zap.Error(auditErr))
	}

	return nil
}

// GetSpecializationByID returns specialization by id
func (s *degreeService) GetSpecializationByID(id uuid.UUID) (*domain.Specialization, error) {
	spec, err := s.specializationRepo.GetSpecializationByID(id)
	if err != nil {
		s.logger.Error("failed to get specialization", zap.Error(err))
		return nil, utils.ErrInternal("failed to get specialization", err)
	}
	if spec == nil {
		return nil, utils.ErrNotFound("specialization not found")
	}
	return spec, nil
}

// ListSpecializationsByDegree lists specializations for a degree, returns empty list if degree inactive
func (s *degreeService) ListSpecializationsByDegree(degreeID uuid.UUID, includeInactive bool) ([]domain.Specialization, error) {
	deg, err := s.degreeRepo.GetDegreeByID(degreeID)
	if err != nil {
		s.logger.Error("failed to check degree", zap.Error(err))
		return nil, utils.ErrInternal("failed to check degree", err)
	}
	if deg == nil {
		return nil, utils.ErrNotFound("degree not found")
	}
	// If degree is inactive return empty list
	if !deg.IsActive && !includeInactive {
		return []domain.Specialization{}, nil
	}

	specs, err := s.specializationRepo.ListSpecializationsByDegree(degreeID, includeInactive)
	if err != nil {
		s.logger.Error("failed to list specializations by degree", zap.Error(err))
		return nil, utils.ErrInternal("failed to list specializations by degree", err)
	}
	return specs, nil
}

// --- Validation helpers ---

func (s *degreeService) validateCreateDegreeRequest(req *dto.CreateDegreeRequest) error {
	if req.DepartmentID == uuid.Nil {
		return utils.ErrBadRequest("department_id is required")
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
	if req.Level == "" {
		return utils.ErrBadRequest("level is required")
	}
	if _, ok := s.allowedDegreeLevelVals[req.Level]; !ok {
		return utils.ErrBadRequest("invalid level value")
	}
	return nil
}

func (s *degreeService) validateUpdateDegreeRequest(req *dto.UpdateDegreeRequest) error {
	if req.Name != "" && (len(req.Name) < 3 || len(req.Name) > 255) {
		return utils.ErrBadRequest("name must be between 3 and 255 characters")
	}
	if req.Code != "" && (len(req.Code) < 2 || len(req.Code) > 50) {
		return utils.ErrBadRequest("code must be between 2 and 50 characters")
	}
	if req.Level != "" {
		if _, ok := s.allowedDegreeLevelVals[req.Level]; !ok {
			return utils.ErrBadRequest("invalid level value")
		}
	}
	return nil
}

func (s *degreeService) validateCreateSpecializationRequest(req *dto.CreateSpecializationRequest) error {
	if req.DegreeID == uuid.Nil {
		return utils.ErrBadRequest("degree_id is required")
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
	if len(req.Code) < 1 || len(req.Code) > 50 {
		return utils.ErrBadRequest("code must be between 1 and 50 characters")
	}
	return nil
}

func (s *degreeService) validateUpdateSpecializationRequest(req *dto.UpdateSpecializationRequest) error {
	if req.Name != "" && (len(req.Name) < 3 || len(req.Name) > 255) {
		return utils.ErrBadRequest("name must be between 3 and 255 characters")
	}
	if req.Code != "" && (len(req.Code) < 1 || len(req.Code) > 50) {
		return utils.ErrBadRequest("code must be between 1 and 50 characters")
	}
	return nil
}

// --- Repository optional helper adaptation ---
// Some repository implementations may not provide a code+department lookup helper.
// The optionalGetByCodeAndDepartment method will attempt a type assertion to a richer repo.
// No compile-time interface assertion is required here; the helper handles runtime assertions.

// Since the existing repository interface in the project may not contain
// GetDegreeByIDByCodeAndDepartment, we defensively attempt a type assertion
// to a richer interface when needed. The call sites above are tolerant:
// if assertion fails we fallback to previous checks (where applicable).

// Extra helper to avoid unused import errors when repo doesn't implement optional method.
func (s *degreeService) optionalGetByCodeAndDepartment(code string, departmentID uuid.UUID) (*domain.Degree, error) {
	// Try a type assertion for an extended interface
	type degreeCodeChecker interface {
		GetDegreeByIDByCodeAndDepartment(code string, departmentID uuid.UUID) (*domain.Degree, error)
	}
	if checker, ok := s.degreeRepo.(degreeCodeChecker); ok {
		return checker.GetDegreeByIDByCodeAndDepartment(code, departmentID)
	}
	return nil, errors.New("not implemented")
}
