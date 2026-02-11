package usecases

import (
	"context"
	"errors"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/dto"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/ports"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/utils"
	"github.com/google/uuid"
	"github.comcom/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
)

// FacultyService handles the business logic for faculty management.
type FacultyService struct {
	facultyRepo ports.FacultyRepository
	auditRepo   ports.AuditRepository
}

// NewFacultyService creates a new FacultyService.
func NewFacultyService(facultyRepo ports.FacultyRepository, auditRepo ports.AuditRepository) *FacultyService {
	return &FacultyService{
		facultyRepo: facultyRepo,
		auditRepo:   auditRepo,
	}
}

// CreateFaculty handles the business logic for creating a new faculty.
func (s *FacultyService) CreateFaculty(ctx context.Context, req dto.CreateFacultyRequest) (*models.Faculty, error) {
	// Business Rule: At least one leader must be provided.
	if len(req.Leaders) == 0 {
		return nil, errors.New("a new faculty must be created with at least one leader")
	}

	faculty := &models.Faculty{
		Name:        req.Name,
		Code:        req.Code,
		Description: req.Description,
	}

	var leaders []models.FacultyLeadership
	for _, l := range req.Leaders {
		leaders = append(leaders, models.FacultyLeadership{
			UserID: l.UserID,
			Role:   l.Role,
		})
	}

	createdFaculty, err := s.facultyRepo.CreateFaculty(ctx, faculty, leaders)
	if err != nil {
		return nil, err
	}

	// Audit Logging
	auditLog := utils.PrepareAuditLog(ctx, "faculty.create", createdFaculty.ID.String(), nil, createdFaculty)
	s.auditRepo.CreateAuditLog(ctx, auditLog)

	return createdFaculty, nil
}

// GetFaculty retrieves a single faculty.
func (s *FacultyService) GetFaculty(ctx context.Context, id uuid.UUID, includeInactive bool) (*models.Faculty, error) {
	return s.facultyRepo.GetFacultyByID(ctx, id, includeInactive)
}

// ListFaculties retrieves a list of faculties.
func (s *FacultyService) ListFaculties(ctx context.Context, includeInactive bool) ([]models.Faculty, error) {
	return s.facultyRepo.ListFaculties(ctx, includeInactive)
}

// UpdateFaculty handles the logic for updating a faculty's metadata.
func (s *FacultyService) UpdateFaculty(ctx context.Context, id uuid.UUID, req dto.UpdateFacultyRequest) (*models.Faculty, error) {
	faculty, err := s.facultyRepo.GetFacultyByID(ctx, id, true) // Get even if inactive
	if err != nil {
		return nil, err
	}

	oldFacultyState := *faculty // for audit logging

	if req.Name != "" {
		faculty.Name = req.Name
	}
	if req.Code != "" {
		faculty.Code = req.Code
	}
	if req.Description != "" {
		faculty.Description = req.Description
	}
	if req.IsActive != nil {
		faculty.IsActive = *req.IsActive
	}

	updatedFaculty, err := s.facultyRepo.UpdateFaculty(ctx, faculty)
	if err != nil {
		return nil, err
	}

	auditLog := utils.PrepareAuditLog(ctx, "faculty.update", updatedFaculty.ID.String(), oldFacultyState, updatedFaculty)
	s.auditRepo.CreateAuditLog(ctx, auditLog)

	return updatedFaculty, nil
}

// DeactivateFaculty soft-deletes a faculty.
func (s *FacultyService) DeactivateFaculty(ctx context.Context, id uuid.UUID) error {
	faculty, err := s.facultyRepo.GetFacultyByID(ctx, id, true)
	if err != nil {
		return err
	}

	err = s.facultyRepo.DeleteFaculty(ctx, id)
	if err != nil {
		return err
	}

	newFacultyState := *faculty
	newFacultyState.IsActive = false
	auditLog := utils.PrepareAuditLog(ctx, "faculty.deactivate", id.String(), faculty, newFacultyState)
	s.auditRepo.CreateAuditLog(ctx, auditLog)

	return nil
}

// GetFacultyLeaders retrieves the leadership panel for a faculty.
func (s *FacultyService) GetFacultyLeaders(ctx context.Context, facultyID uuid.UUID) ([]models.FacultyLeadership, error) {
	return s.facultyRepo.GetFacultyLeaders(ctx, facultyID)
}
