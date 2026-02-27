package service

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/4yrg/gradeloop-core-v2/assessment-service/internal/client"
	"github.com/4yrg/gradeloop-core-v2/assessment-service/internal/domain"
	"github.com/4yrg/gradeloop-core-v2/assessment-service/internal/dto"
	"github.com/4yrg/gradeloop-core-v2/assessment-service/internal/repository"
	"github.com/4yrg/gradeloop-core-v2/assessment-service/internal/utils"
	"go.uber.org/zap"
	"gorm.io/datatypes"
)

// RubricService defines the business-logic contract for rubric management
type RubricService interface {
	CreateRubric(assignmentID uuid.UUID, req *dto.CreateRubricRequest, username, ipAddress, userAgent string) error
	GetRubric(assignmentID uuid.UUID) (*domain.RubricConfig, int, error)
	UpdateRubric(assignmentID uuid.UUID, req *dto.UpdateRubricRequest, username, ipAddress, userAgent string) error
	ApplyInstructorOverride(submissionID uuid.UUID, req *dto.InstructorOverrideRequest, username string) error
}

// rubricService is the concrete implementation
type rubricService struct {
	assignmentRepo repository.AssignmentRepository
	submissionRepo repository.SubmissionRepository
	auditClient    *client.AuditClient
	logger         *zap.Logger
}

// NewRubricService wires all dependencies and returns a RubricService
func NewRubricService(
	assignmentRepo repository.AssignmentRepository,
	submissionRepo repository.SubmissionRepository,
	auditClient *client.AuditClient,
	logger *zap.Logger,
) RubricService {
	return &rubricService{
		assignmentRepo: assignmentRepo,
		submissionRepo: submissionRepo,
		auditClient:    auditClient,
		logger:         logger,
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// CreateRubric
// ─────────────────────────────────────────────────────────────────────────────

func (s *rubricService) CreateRubric(
	assignmentID uuid.UUID,
	req *dto.CreateRubricRequest,
	username, ipAddress, userAgent string,
) error {
	// 1. Validate assignment exists
	assignment, err := s.assignmentRepo.GetAssignmentByID(assignmentID)
	if err != nil {
		s.logger.Error("failed to load assignment", zap.String("id", assignmentID.String()), zap.Error(err))
		return utils.ErrInternal("failed to load assignment", err)
	}
	if assignment == nil {
		return utils.ErrNotFound("assignment not found")
	}

	// 2. Validate execution weight is fixed at 30%
	if req.Execution.Weight != dto.FixedExecutionWeight {
		return utils.ErrBadRequest(fmt.Sprintf("execution weight must be fixed at %d%%", dto.FixedExecutionWeight))
	}
	if !req.Execution.Fixed {
		return utils.ErrBadRequest("execution weight must be marked as fixed")
	}

	// 3. Validate dimensions
	if err := s.validateDimensions(req.Dimensions); err != nil {
		return err
	}

	// 4. Calculate total weight
	totalWeight := req.Execution.Weight
	for _, dim := range req.Dimensions {
		totalWeight += dim.Weight
	}
	if totalWeight != dto.TotalRubricWeight {
		return utils.ErrBadRequest(fmt.Sprintf("total weight must equal %d%%, got %d%%", dto.TotalRubricWeight, totalWeight))
	}

	// 5. Build rubric config
	rubricConfig := domain.RubricConfig{
		Execution: domain.ExecutionConfig{
			Weight:    req.Execution.Weight,
			Fixed:     req.Execution.Fixed,
			TestCases: req.Execution.TestCases,
		},
		Dimensions: make([]domain.RubricDimension, len(req.Dimensions)),
	}
	for i, dim := range req.Dimensions {
		rubricConfig.Dimensions[i] = domain.RubricDimension{
			ID:          dim.ID,
			Name:        dim.Name,
			Weight:      dim.Weight,
			Description: dim.Description,
		}
	}

	// 6. Serialize to JSON
	rubricJSON, err := json.Marshal(rubricConfig)
	if err != nil {
		s.logger.Error("failed to marshal rubric config", zap.Error(err))
		return utils.ErrInternal("failed to process rubric configuration", err)
	}

	// 7. Get current version and increment
	currentVersion, err := s.assignmentRepo.GetRubricVersion(assignmentID)
	if err != nil {
		s.logger.Error("failed to get rubric version", zap.Error(err))
		return utils.ErrInternal("failed to get rubric version", err)
	}
	newVersion := currentVersion + 1
	if newVersion < 1 {
		newVersion = 1
	}

	// 8. Persist rubric
	if err := s.assignmentRepo.UpdateRubric(assignmentID, datatypes.JSON(rubricJSON), newVersion); err != nil {
		s.logger.Error("failed to update rubric", zap.String("id", assignmentID.String()), zap.Error(err))
		return utils.ErrInternal("failed to save rubric configuration", err)
	}

	// 9. Audit log
	changes := map[string]interface{}{
		"rubric_config":  rubricConfig,
		"rubric_version": newVersion,
	}
	if auditErr := s.auditClient.LogAction(
		string(client.AuditActionAssignmentUpdated),
		"assignment",
		assignmentID.String(),
		0,
		username,
		changes,
		nil,
		ipAddress,
		userAgent,
	); auditErr != nil {
		s.logger.Warn("failed to write audit log", zap.Error(auditErr))
	}

	s.logger.Info("rubric created",
		zap.String("assignment_id", assignmentID.String()),
		zap.Int("version", newVersion),
	)

	return nil
}

// ─────────────────────────────────────────────────────────────────────────────
// GetRubric
// ─────────────────────────────────────────────────────────────────────────────

func (s *rubricService) GetRubric(assignmentID uuid.UUID) (*domain.RubricConfig, int, error) {
	assignment, err := s.assignmentRepo.GetAssignmentByID(assignmentID)
	if err != nil {
		s.logger.Error("failed to load assignment", zap.String("id", assignmentID.String()), zap.Error(err))
		return nil, 0, utils.ErrInternal("failed to load assignment", err)
	}
	if assignment == nil {
		return nil, 0, utils.ErrNotFound("assignment not found")
	}

	// If no rubric configured, return nil
	if assignment.RubricConfig == nil || len(assignment.RubricConfig) == 0 {
		return nil, assignment.RubricVersion, nil
	}

	var rubricConfig domain.RubricConfig
	if err := json.Unmarshal(assignment.RubricConfig, &rubricConfig); err != nil {
		s.logger.Error("failed to unmarshal rubric config", zap.Error(err))
		return nil, 0, utils.ErrInternal("failed to parse rubric configuration", err)
	}

	return &rubricConfig, assignment.RubricVersion, nil
}

// ─────────────────────────────────────────────────────────────────────────────
// UpdateRubric
// ─────────────────────────────────────────────────────────────────────────────

func (s *rubricService) UpdateRubric(
	assignmentID uuid.UUID,
	req *dto.UpdateRubricRequest,
	username, ipAddress, userAgent string,
) error {
	// 1. Validate assignment exists
	assignment, err := s.assignmentRepo.GetAssignmentByID(assignmentID)
	if err != nil {
		s.logger.Error("failed to load assignment", zap.String("id", assignmentID.String()), zap.Error(err))
		return utils.ErrInternal("failed to load assignment", err)
	}
	if assignment == nil {
		return utils.ErrNotFound("assignment not found")
	}

	// 2. Get existing rubric
	existingRubric, _, err := s.GetRubric(assignmentID)
	if err != nil {
		return err
	}
	if existingRubric == nil {
		return utils.ErrBadRequest("no existing rubric found for this assignment")
	}

	// 3. Validate new dimensions
	if err := s.validateDimensions(req.Dimensions); err != nil {
		return err
	}

	// 4. Calculate total weight (execution is fixed at 30%)
	totalWeight := dto.FixedExecutionWeight
	for _, dim := range req.Dimensions {
		totalWeight += dim.Weight
	}
	if totalWeight != dto.TotalRubricWeight {
		return utils.ErrBadRequest(fmt.Sprintf("total weight must equal %d%%, got %d%%", dto.TotalRubricWeight, totalWeight))
	}

	// 5. Build updated rubric config (preserve execution config)
	updatedConfig := domain.RubricConfig{
		Execution:  existingRubric.Execution,
		Dimensions: make([]domain.RubricDimension, len(req.Dimensions)),
	}
	for i, dim := range req.Dimensions {
		updatedConfig.Dimensions[i] = domain.RubricDimension{
			ID:          dim.ID,
			Name:        dim.Name,
			Weight:      dim.Weight,
			Description: dim.Description,
		}
	}

	// 6. Serialize to JSON
	rubricJSON, err := json.Marshal(updatedConfig)
	if err != nil {
		s.logger.Error("failed to marshal rubric config", zap.Error(err))
		return utils.ErrInternal("failed to process rubric configuration", err)
	}

	// 7. Increment version
	newVersion := assignment.RubricVersion + 1

	// 8. Persist updated rubric
	if err := s.assignmentRepo.UpdateRubric(assignmentID, datatypes.JSON(rubricJSON), newVersion); err != nil {
		s.logger.Error("failed to update rubric", zap.String("id", assignmentID.String()), zap.Error(err))
		return utils.ErrInternal("failed to save rubric configuration", err)
	}

	// 9. Audit log
	changes := map[string]interface{}{
		"rubric_config":  updatedConfig,
		"rubric_version": newVersion,
		"previous_version": assignment.RubricVersion,
	}
	if auditErr := s.auditClient.LogAction(
		string(client.AuditActionAssignmentUpdated),
		"assignment",
		assignmentID.String(),
		0,
		username,
		changes,
		nil,
		ipAddress,
		userAgent,
	); auditErr != nil {
		s.logger.Warn("failed to write audit log", zap.Error(auditErr))
	}

	s.logger.Info("rubric updated",
		zap.String("assignment_id", assignmentID.String()),
		zap.Int("new_version", newVersion),
		zap.Int("previous_version", assignment.RubricVersion),
	)

	return nil
}

// ─────────────────────────────────────────────────────────────────────────────
// ApplyInstructorOverride
// ─────────────────────────────────────────────────────────────────────────────

func (s *rubricService) ApplyInstructorOverride(
	submissionID uuid.UUID,
	req *dto.InstructorOverrideRequest,
	username string,
) error {
	// 1. Validate submission exists
	submission, err := s.submissionRepo.GetSubmission(submissionID)
	if err != nil {
		s.logger.Error("failed to load submission", zap.String("id", submissionID.String()), zap.Error(err))
		return utils.ErrInternal("failed to load submission", err)
	}
	if submission == nil {
		return utils.ErrNotFound("submission not found")
	}

	// 2. Validate adjusted score
	if req.AdjustedScore < 0 || req.AdjustedScore > 100 {
		return utils.ErrBadRequest("adjusted score must be between 0 and 100")
	}

	// 3. Build override record
	originalScore := submission.TotalScore
	override := domain.InstructorOverride{
		AdjustedScore: req.AdjustedScore,
		Reason:        req.Reason,
		OverriddenBy:  username,
		OverriddenAt:  time.Now().UTC(),
		OriginalScore: originalScore,
	}

	// 4. Serialize override
	overrideJSON, err := json.Marshal(override)
	if err != nil {
		s.logger.Error("failed to marshal override", zap.Error(err))
		return utils.ErrInternal("failed to process override", err)
	}

	// 5. Apply override
	if err := s.submissionRepo.ApplyInstructorOverride(submissionID, datatypes.JSON(overrideJSON), req.AdjustedScore); err != nil {
		s.logger.Error("failed to apply instructor override", zap.String("id", submissionID.String()), zap.Error(err))
		return utils.ErrInternal("failed to apply instructor override", err)
	}

	s.logger.Info("instructor override applied",
		zap.String("submission_id", submissionID.String()),
		zap.Int("original_score", originalScore),
		zap.Int("adjusted_score", req.AdjustedScore),
		zap.String("instructor", username),
	)

	return nil
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Methods
// ─────────────────────────────────────────────────────────────────────────────

func (s *rubricService) validateDimensions(dimensions []dto.RubricDimensionDTO) error {
	// Check for at least one dimension
	if len(dimensions) == 0 {
		return utils.ErrBadRequest("at least one dimension is required")
	}

	// Check for duplicate IDs
	seenIDs := make(map[string]bool)
	for _, dim := range dimensions {
		if seenIDs[dim.ID] {
			return utils.ErrBadRequest(fmt.Sprintf("duplicate dimension ID: %s", dim.ID))
		}
		seenIDs[dim.ID] = true

		// Validate dimension ID
		if !dto.IsValidDimensionID(dim.ID) {
			return utils.ErrBadRequest(fmt.Sprintf("invalid dimension ID: %s", dim.ID))
		}

		// Validate weight range
		if dim.Weight < dto.MinDimensionWeight || dim.Weight > dto.MaxDimensionWeight {
			return utils.ErrBadRequest(fmt.Sprintf("dimension %s weight must be between %d and %d",
				dim.ID, dto.MinDimensionWeight, dto.MaxDimensionWeight))
		}

		// Validate name is not empty
		if dim.Name == "" {
			return utils.ErrBadRequest(fmt.Sprintf("dimension %s name cannot be empty", dim.ID))
		}
	}

	return nil
}
