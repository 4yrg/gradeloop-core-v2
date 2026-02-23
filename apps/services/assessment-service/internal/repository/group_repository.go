package repository

import (
	"errors"

	"github.com/google/uuid"
	"github.com/4yrg/gradeloop-core-v2/assessment-service/internal/domain"
	"gorm.io/gorm"
)

// GroupRepository defines all data operations for submission groups.
type GroupRepository interface {
	// CreateGroup inserts a new group record.
	CreateGroup(group *domain.SubmissionGroup) error

	// GetGroup loads a group by its primary key.
	// Returns (nil, nil) when not found.
	GetGroup(id uuid.UUID) (*domain.SubmissionGroup, error)

	// FindByAssignment returns all groups that belong to the given assignment.
	FindByAssignment(assignmentID uuid.UUID) ([]domain.SubmissionGroup, error)

	// FindGroupByAssignmentAndMember returns the group for the given assignment
	// that contains the specified member UUID.  Returns (nil, nil) when no
	// such group exists.  This is used to validate that a submitting user
	// actually belongs to the group they claim.
	FindGroupByAssignmentAndMember(assignmentID uuid.UUID, memberID string) (*domain.SubmissionGroup, error)
}

// groupRepository is the concrete GORM-backed implementation.
type groupRepository struct {
	db *gorm.DB
}

// NewGroupRepository creates a new groupRepository.
func NewGroupRepository(db *gorm.DB) GroupRepository {
	return &groupRepository{db: db}
}

// ─────────────────────────────────────────────────────────────────────────────
// CreateGroup
// ─────────────────────────────────────────────────────────────────────────────

func (r *groupRepository) CreateGroup(group *domain.SubmissionGroup) error {
	return r.db.Create(group).Error
}

// ─────────────────────────────────────────────────────────────────────────────
// GetGroup
// ─────────────────────────────────────────────────────────────────────────────

// GetGroup loads a single group by its UUID primary key.
// Returns (nil, nil) when no matching record is found.
func (r *groupRepository) GetGroup(id uuid.UUID) (*domain.SubmissionGroup, error) {
	var group domain.SubmissionGroup

	err := r.db.
		Where("id = ?", id).
		First(&group).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	return &group, nil
}

// ─────────────────────────────────────────────────────────────────────────────
// FindByAssignment
// ─────────────────────────────────────────────────────────────────────────────

// FindByAssignment returns all groups that belong to a specific assignment,
// ordered by creation time ascending.
func (r *groupRepository) FindByAssignment(assignmentID uuid.UUID) ([]domain.SubmissionGroup, error) {
	var groups []domain.SubmissionGroup

	err := r.db.
		Where("assignment_id = ?", assignmentID).
		Order("created_at ASC").
		Find(&groups).Error

	if err != nil {
		return nil, err
	}

	return groups, nil
}

// ─────────────────────────────────────────────────────────────────────────────
// FindGroupByAssignmentAndMember
// ─────────────────────────────────────────────────────────────────────────────

// FindGroupByAssignmentAndMember uses the PostgreSQL JSONB containment operator
// (@>) to efficiently find a group for the given assignment whose members array
// includes the specified member UUID string.
//
// The query translates to:
//
//	SELECT * FROM groups
//	WHERE assignment_id = ?
//	AND members @> '["<memberID>"]'::jsonb
//	LIMIT 1
//
// Returns (nil, nil) when no matching group is found.
func (r *groupRepository) FindGroupByAssignmentAndMember(
	assignmentID uuid.UUID,
	memberID string,
) (*domain.SubmissionGroup, error) {
	var group domain.SubmissionGroup

	// Build a JSONB fragment containing just this member so PostgreSQL can use
	// the @> (contains) operator against the members array.
	jsonFragment := `["` + memberID + `"]`

	err := r.db.
		Where("assignment_id = ? AND members @> ?::jsonb", assignmentID, jsonFragment).
		First(&group).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	return &group, nil
}
