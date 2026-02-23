package service

import (
	"encoding/json"

	"github.com/google/uuid"
	"github.com/4yrg/gradeloop-core-v2/assessment-service/internal/client"
	"github.com/4yrg/gradeloop-core-v2/assessment-service/internal/domain"
	"github.com/4yrg/gradeloop-core-v2/assessment-service/internal/dto"
	"github.com/4yrg/gradeloop-core-v2/assessment-service/internal/repository"
	"github.com/4yrg/gradeloop-core-v2/assessment-service/internal/utils"
	"go.uber.org/zap"
	"gorm.io/datatypes"
)

// ─────────────────────────────────────────────────────────────────────────────
// Interface
// ─────────────────────────────────────────────────────────────────────────────

// GroupService defines the business-logic contract for submission group
// management.
type GroupService interface {
	// CreateGroup validates the request, deduplicates members, and persists the
	// new group record.
	CreateGroup(
		req *dto.CreateGroupRequest,
		createdBy uuid.UUID,
		username, ipAddress, userAgent string,
	) (*domain.SubmissionGroup, error)

	// GetGroup loads a single group by its primary key.
	GetGroup(id uuid.UUID) (*domain.SubmissionGroup, error)

	// FindByAssignment returns all groups that belong to the given assignment.
	FindByAssignment(assignmentID uuid.UUID) ([]domain.SubmissionGroup, error)
}

// ─────────────────────────────────────────────────────────────────────────────
// Implementation
// ─────────────────────────────────────────────────────────────────────────────

type groupService struct {
	groupRepo      repository.GroupRepository
	assignmentRepo repository.AssignmentRepository
	auditClient    *client.AuditClient
	logger         *zap.Logger
}

// NewGroupService wires all dependencies and returns a GroupService.
func NewGroupService(
	groupRepo repository.GroupRepository,
	assignmentRepo repository.AssignmentRepository,
	auditClient *client.AuditClient,
	logger *zap.Logger,
) GroupService {
	return &groupService{
		groupRepo:      groupRepo,
		assignmentRepo: assignmentRepo,
		auditClient:    auditClient,
		logger:         logger,
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// CreateGroup
// ─────────────────────────────────────────────────────────────────────────────

func (s *groupService) CreateGroup(
	req *dto.CreateGroupRequest,
	createdBy uuid.UUID,
	username, ipAddress, userAgent string,
) (*domain.SubmissionGroup, error) {
	// ── 1. Basic validation ──────────────────────────────────────────────────
	if req.AssignmentID == uuid.Nil {
		return nil, utils.ErrBadRequest("assignment_id is required")
	}
	if len(req.Members) == 0 {
		return nil, utils.ErrBadRequest("members must not be empty")
	}

	// ── 2. Load and validate the assignment ──────────────────────────────────
	assignment, err := s.assignmentRepo.GetAssignmentByID(req.AssignmentID)
	if err != nil {
		s.logger.Error("failed to load assignment for group creation",
			zap.String("assignment_id", req.AssignmentID.String()),
			zap.Error(err),
		)
		return nil, utils.ErrInternal("failed to load assignment", err)
	}
	if assignment == nil {
		return nil, utils.ErrNotFound("assignment not found")
	}
	if !assignment.IsActive {
		return nil, utils.ErrBadRequest("assignment is not active")
	}
	if !assignment.AllowGroupSubmission {
		return nil, utils.ErrBadRequest("assignment does not allow group submissions")
	}

	// ── 3. Deduplicate and validate member UUIDs ─────────────────────────────
	uniqueMembers, err := deduplicateMembers(req.Members)
	if err != nil {
		return nil, err
	}

	// ── 4. Enforce max group size ────────────────────────────────────────────
	if assignment.MaxGroupSize > 0 && len(uniqueMembers) > assignment.MaxGroupSize {
		return nil, utils.ErrBadRequest(
			"group size exceeds the maximum allowed for this assignment",
		)
	}

	// ── 5. Serialise members to JSONB ────────────────────────────────────────
	membersJSON, err := json.Marshal(uniqueMembers)
	if err != nil {
		s.logger.Error("failed to marshal group members", zap.Error(err))
		return nil, utils.ErrInternal("failed to process group members", err)
	}

	group := &domain.SubmissionGroup{
		AssignmentID: req.AssignmentID,
		Members:      datatypes.JSON(membersJSON),
	}

	// ── 6. Persist ───────────────────────────────────────────────────────────
	if err := s.groupRepo.CreateGroup(group); err != nil {
		s.logger.Error("failed to create group", zap.Error(err))
		return nil, utils.ErrInternal("failed to create group", err)
	}

	// ── 7. Audit log ─────────────────────────────────────────────────────────
	changes := map[string]interface{}{
		"assignment_id": req.AssignmentID.String(),
		"members":       uniqueMembers,
		"member_count":  len(uniqueMembers),
	}

	if auditErr := s.auditClient.LogAction(
		string(client.AuditActionGroupCreated),
		"group",
		group.ID.String(),
		0,
		username,
		changes,
		nil,
		ipAddress,
		userAgent,
	); auditErr != nil {
		s.logger.Warn("failed to write audit log for group creation", zap.Error(auditErr))
	}

	s.logger.Info("group created",
		zap.String("id", group.ID.String()),
		zap.String("assignment_id", req.AssignmentID.String()),
		zap.Int("member_count", len(uniqueMembers)),
	)

	return group, nil
}

// ─────────────────────────────────────────────────────────────────────────────
// GetGroup
// ─────────────────────────────────────────────────────────────────────────────

func (s *groupService) GetGroup(id uuid.UUID) (*domain.SubmissionGroup, error) {
	group, err := s.groupRepo.GetGroup(id)
	if err != nil {
		s.logger.Error("failed to load group", zap.String("id", id.String()), zap.Error(err))
		return nil, utils.ErrInternal("failed to load group", err)
	}
	if group == nil {
		return nil, utils.ErrNotFound("group not found")
	}
	return group, nil
}

// ─────────────────────────────────────────────────────────────────────────────
// FindByAssignment
// ─────────────────────────────────────────────────────────────────────────────

func (s *groupService) FindByAssignment(assignmentID uuid.UUID) ([]domain.SubmissionGroup, error) {
	if assignmentID == uuid.Nil {
		return nil, utils.ErrBadRequest("assignment_id is required")
	}

	groups, err := s.groupRepo.FindByAssignment(assignmentID)
	if err != nil {
		s.logger.Error("failed to find groups by assignment",
			zap.String("assignment_id", assignmentID.String()),
			zap.Error(err),
		)
		return nil, utils.ErrInternal("failed to find groups", err)
	}

	return groups, nil
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

// deduplicateMembers validates each entry as a UUID string, removes duplicates
// while preserving order, and returns the clean slice.
// Returns a 400 AppError for any malformed UUID value.
func deduplicateMembers(raw []string) ([]string, error) {
	seen := make(map[string]struct{}, len(raw))
	result := make([]string, 0, len(raw))

	for _, m := range raw {
		if _, err := uuid.Parse(m); err != nil {
			return nil, utils.ErrBadRequest("invalid member ID: " + m + " is not a valid UUID")
		}
		if _, exists := seen[m]; !exists {
			seen[m] = struct{}{}
			result = append(result, m)
		}
	}

	if len(result) == 0 {
		return nil, utils.ErrBadRequest("members must not be empty after deduplication")
	}

	return result, nil
}
