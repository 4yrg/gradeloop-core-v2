package usecases

import (
	"context"
	"errors"

	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/dto"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/application/ports"
	"github.com/4yrg/gradeloop-core-v2/apps/services/academics-service/internal/domain/models"
	"github.com/google/uuid"
)

// I'm assuming an audit repository port exists, similar to the iam-service.
// For now, I'll define it here. In a real scenario, this would be in a shared location.
type AuditRepository interface {
	CreateAuditLog(ctx context.Context, log *models.AuditLog) error
}

type FacultyService struct {
	facultyRepo ports.FacultyRepository
	auditRepo   AuditRepository
}

func NewFacultyService(facultyRepo ports.FacultyRepository, auditRepo AuditRepository) *FacultyService {
	return &FacultyService{
		facultyRepo: facultyRepo,
		auditRepo:   auditRepo,
	}
}

// CreateFaculty handles the business logic for creating a new faculty.
func (s *FacultyService) CreateFaculty(ctx context.Context, req dto.CreateFacultyRequest) (*models.Faculty, error) {
	// Business Rule: At least one leader must be provided.
	// This is also handled by validation on the DTO, but service layer should enforce it.
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

	// The repository handles the transaction for creating both faculty and leaders.
	createdFaculty, err := s.facultyRepo.CreateFaculty(ctx, faculty, leaders)
	if err != nil {
		return nil, err
	}

	// Audit Logging
	// s.auditRepo.CreateAuditLog(ctx, prepareAudit("faculty.create", createdFaculty.ID, nil, createdFaculty))

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

	// oldFacultyState := *faculty // for audit logging

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
		// Business Rule: Cannot deactivate if it's the last active leader.
		// This rule is about leadership, not the faculty itself. Let's reconsider.
		// The rule is "A Faculty must have at least one active leader at all times."
		// Deactivating the faculty doesn't violate this. Deactivating a *leader* would.
		// This will be handled in a separate `UpdateLeadership` method not required by the story yet.
		faculty.IsActive = *req.IsActive
	}

	updatedFaculty, err := s.facultyRepo.UpdateFaculty(ctx, faculty)
	if err != nil {
		return nil, err
	}

	// s.auditRepo.CreateAuditLog(ctx, prepareAudit("faculty.update", updatedFaculty.ID, oldFacultyState, updatedFaculty))

	return updatedFaculty, nil
}

// DeactivateFaculty soft-deletes a faculty.
func (s *FacultyService) DeactivateFaculty(ctx context.Context, id uuid.UUID) error {
	faculty, err := s.facultyRepo.GetFacultyByID(ctx, id, true)
	if err != nil {
		return err
	}

	// oldFacultyState := *faculty // for audit logging

	err = s.facultyRepo.DeleteFaculty(ctx, id)
	if err != nil {
		return err
	}

	// faculty.IsActive = false // to log the new state
	// s.auditRepo.CreateAuditLog(ctx, prepareAudit("faculty.deactivate", id, oldFacultyState, faculty))

	return nil
}

// GetFacultyLeaders retrieves the leadership panel for a faculty.
func (s *FacultyService) GetFacultyLeaders(ctx context.Context, facultyID uuid.UUID) ([]models.FacultyLeadership, error) {
	return s.facultyRepo.GetFacultyLeaders(ctx, facultyID)
}
