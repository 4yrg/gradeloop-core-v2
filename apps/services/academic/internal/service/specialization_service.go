package service

import (
	"time"

	"github.com/google/uuid"
	"github.com/gradeloop/academic-service/internal/client"
	"github.com/gradeloop/academic-service/internal/domain"
	"github.com/gradeloop/academic-service/internal/dto"
	"github.com/gradeloop/academic-service/internal/repository"
	"github.com/gradeloop/academic-service/internal/utils"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// SpecializationService defines operations for specializations
type SpecializationService interface {
	CreateSpecialization(req *dto.CreateSpecializationRequest, userID uint, email, ipAddress, userAgent string) (*domain.Specialization, error)
	UpdateSpecialization(id uuid.UUID, req *dto.UpdateSpecializationRequest, userID uint, email, ipAddress, userAgent string) (*domain.Specialization, error)
	// Note: `isActive` indicates the desired active state (handler sends false to deactivate)
	DeactivateSpecialization(id uuid.UUID, isActive bool, userID uint, email, ipAddress, userAgent string) error
	GetSpecializationByID(id uuid.UUID) (*domain.Specialization, error)
	ListSpecializationsByDegree(degreeID uuid.UUID, includeInactive bool) ([]domain.Specialization, error)
}

type specializationService struct {
	db                 *gorm.DB
	specializationRepo repository.SpecializationRepository
	degreeRepo         repository.DegreeRepository
	auditClient        *client.AuditClient
	logger             *zap.Logger
}

func NewSpecializationService(
	db *gorm.DB,
	specializationRepo repository.SpecializationRepository,
	degreeRepo repository.DegreeRepository,
	auditClient *client.AuditClient,
	logger *zap.Logger,
) SpecializationService {
	return &specializationService{
		db:                 db,
		specializationRepo: specializationRepo,
		degreeRepo:         degreeRepo,
		auditClient:        auditClient,
		logger:             logger,
	}
}

func (s *specializationService) CreateSpecialization(req *dto.CreateSpecializationRequest, userID uint, email, ipAddress, userAgent string) (*domain.Specialization, error) {
	// Validate
	if req.DegreeID == uuid.Nil {
		return nil, utils.ErrBadRequest("degree_id is required")
	}
	if req.Name == "" || len(req.Name) < 3 || len(req.Name) > 255 {
		return nil, utils.ErrBadRequest("name must be between 3 and 255 characters")
	}
	if req.Code == "" || len(req.Code) > 50 {
		return nil, utils.ErrBadRequest("invalid code")
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

	// Ensure code uniqueness within degree
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

func (s *specializationService) UpdateSpecialization(id uuid.UUID, req *dto.UpdateSpecializationRequest, userID uint, email, ipAddress, userAgent string) (*domain.Specialization, error) {
	// Validate
	if req.Name != "" && (len(req.Name) < 3 || len(req.Name) > 255) {
		return nil, utils.ErrBadRequest("name must be between 3 and 255 characters")
	}
	if req.Code != "" && len(req.Code) > 50 {
		return nil, utils.ErrBadRequest("invalid code")
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
		// uniqueness check within degree
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

func (s *specializationService) DeactivateSpecialization(id uuid.UUID, isActive bool, userID uint, email, ipAddress, userAgent string) error {
	spec, err := s.specializationRepo.GetSpecializationByID(id)
	if err != nil {
		s.logger.Error("failed to load specialization", zap.Error(err))
		return utils.ErrInternal("failed to load specialization", err)
	}
	if spec == nil {
		return utils.ErrNotFound("specialization not found")
	}

	// If desired state is the same, no-op
	if spec.IsActive == isActive {
		return nil
	}

	spec.IsActive = isActive
	spec.UpdatedAt = time.Now()

	if err := s.specializationRepo.UpdateSpecialization(spec); err != nil {
		s.logger.Error("failed to update specialization active state", zap.Error(err))
		return utils.ErrInternal("failed to update specialization", err)
	}

	action := client.AuditActionSpecializationUpdated
	if !isActive {
		action = client.AuditActionSpecializationDeactivated
	}
	changes := map[string]interface{}{"is_active": map[string]interface{}{"old": !isActive, "new": isActive}}

	if auditErr := s.auditClient.LogSpecializationAction(action, spec.ID, userID, email, changes, nil, ipAddress, userAgent); auditErr != nil {
		s.logger.Warn("failed to log audit event", zap.Error(auditErr))
	}

	return nil
}

func (s *specializationService) GetSpecializationByID(id uuid.UUID) (*domain.Specialization, error) {
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

func (s *specializationService) ListSpecializationsByDegree(degreeID uuid.UUID, includeInactive bool) ([]domain.Specialization, error) {
	deg, err := s.degreeRepo.GetDegreeByID(degreeID)
	if err != nil {
		s.logger.Error("failed to check degree", zap.Error(err))
		return nil, utils.ErrInternal("failed to check degree", err)
	}
	if deg == nil {
		return nil, utils.ErrNotFound("degree not found")
	}
	// If degree inactive and caller does not want inactive, return empty list
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
