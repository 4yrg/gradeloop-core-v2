package handler

import (
	"encoding/json"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"github.com/4yrg/gradeloop-core-v2/assessment-service/internal/domain"
	"github.com/4yrg/gradeloop-core-v2/assessment-service/internal/dto"
	"github.com/4yrg/gradeloop-core-v2/assessment-service/internal/service"
	"github.com/4yrg/gradeloop-core-v2/assessment-service/internal/utils"
	"go.uber.org/zap"
)

// GroupHandler handles submission-group-related HTTP requests.
type GroupHandler struct {
	groupService service.GroupService
	logger       *zap.Logger
}

// NewGroupHandler creates a new GroupHandler.
func NewGroupHandler(groupService service.GroupService, logger *zap.Logger) *GroupHandler {
	return &GroupHandler{
		groupService: groupService,
		logger:       logger,
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /groups
// ─────────────────────────────────────────────────────────────────────────────

// CreateGroup handles POST /groups.
// Validates the assignment exists and allows group submissions, deduplicates
// the member list, and persists the new group record.
func (h *GroupHandler) CreateGroup(c fiber.Ctx) error {
	var req dto.CreateGroupRequest
	if err := c.Bind().JSON(&req); err != nil {
		return utils.ErrBadRequest("invalid request body")
	}

	username := requireUsername(c)
	if username == "" {
		return utils.ErrUnauthorized("user not authenticated")
	}

	createdBy := requireUserID(c)
	if createdBy == uuid.Nil {
		return utils.ErrUnauthorized("user not authenticated")
	}

	group, err := h.groupService.CreateGroup(
		&req,
		createdBy,
		username,
		c.IP(),
		c.Get("User-Agent"),
	)
	if err != nil {
		return err
	}

	return c.Status(fiber.StatusCreated).JSON(toGroupResponse(group))
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /groups/:id
// ─────────────────────────────────────────────────────────────────────────────

// GetGroup handles GET /groups/:id.
// Returns the group metadata including the deserialized members array.
func (h *GroupHandler) GetGroup(c fiber.Ctx) error {
	id, err := parseUUID(c, "id")
	if err != nil {
		return err
	}

	group, err := h.groupService.GetGroup(id)
	if err != nil {
		return err
	}

	return c.Status(fiber.StatusOK).JSON(toGroupResponse(group))
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

// toGroupResponse converts a domain.SubmissionGroup into its DTO
// representation, unmarshalling the JSONB members array into a typed
// []string slice so callers receive clean JSON instead of a raw bytes blob.
func toGroupResponse(g *domain.SubmissionGroup) dto.GroupResponse {
	var members []string

	if g.Members != nil {
		// Best-effort unmarshal — if the JSON is somehow malformed we return an
		// empty slice rather than erroring out in a read path.
		_ = json.Unmarshal(g.Members, &members)
	}

	if members == nil {
		members = []string{}
	}

	return dto.GroupResponse{
		ID:           g.ID,
		AssignmentID: g.AssignmentID,
		Members:      members,
		CreatedAt:    g.CreatedAt,
	}
}
