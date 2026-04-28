package domain

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// Policy represents an authorization policy
type Policy struct {
	ID         uuid.UUID       `gorm:"type:uuid;primaryKey" json:"id"`
	TenantID   uuid.UUID       `gorm:"type:uuid;index" json:"tenant_id"`
	Action     string          `gorm:"size:100;index" json:"action"`   // "course:create"
	Resource   string          `gorm:"size:100;index" json:"resource"` // "course"
	Effect     string          `gorm:"size:10" json:"effect"`          // "allow" or "deny"
	Conditions json.RawMessage `gorm:"type:jsonb" json:"conditions,omitempty"`
	RoleFilter string          `gorm:"size:50" json:"role_filter,omitempty"` // Optional role restriction
	Priority   int             `gorm:"default:0" json:"priority"`
	IsActive   bool            `gorm:"default:true" json:"is_active"`
	CreatedAt  time.Time       `json:"created_at"`
	UpdatedAt  time.Time       `json:"updated_at"`
}

// PolicyCondition represents ABAC conditions
type PolicyCondition struct {
	Attribute string      `json:"attribute"` // "user.role", "resource.owner_id"
	Operator  string      `json:"operator"`  // "eq", "ne", "in", "matches"
	Value     interface{} `json:"value"`
}

// PolicyAudit represents authorization audit log
type PolicyAudit struct {
	ID           uuid.UUID       `gorm:"type:uuid;primaryKey" json:"id"`
	PolicyID     uuid.UUID       `gorm:"type:uuid;index" json:"policy_id"`
	UserID       uuid.UUID       `gorm:"type:uuid;index" json:"user_id"`
	TenantID     uuid.UUID       `gorm:"type:uuid;index" json:"tenant_id"`
	Action       string          `gorm:"size:100" json:"action"`
	ResourceID   uuid.UUID       `gorm:"type:uuid" json:"resource_id"`
	ResourceType string          `gorm:"size:50" json:"resource_type"`
	Decision     string          `gorm:"size:10" json:"decision"` // "allow" or "deny"
	Reason       string          `gorm:"size:255" json:"reason"`
	Details      json.RawMessage `gorm:"type:jsonb" json:"details,omitempty"`
	CreatedAt    time.Time       `json:"created_at"`
}

// Resource represents a resource being accessed
type Resource struct {
	ID        uuid.UUID              `json:"id"`
	Type      string                 `json:"type"`
	TenantID  uuid.UUID              `json:"tenant_id"`
	OwnerID   uuid.UUID              `json:"owner_id,omitempty"`
	CreatedBy uuid.UUID              `json:"created_by,omitempty"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// AuthzDecision represents an authorization decision
type AuthzDecision struct {
	Allowed  bool      `json:"allowed"`
	Reason   string    `json:"reason"`
	PolicyID uuid.UUID `json:"policy_id,omitempty"`
	Details  string    `json:"details,omitempty"`
}

// Action constants
const (
	ActionRead    = "read"
	ActionCreate  = "create"
	ActionUpdate  = "update"
	ActionDelete  = "delete"
	ActionExecute = "execute"
	ActionAll     = "*"
)

// ResourceType constants
const (
	ResourceCourse       = "course"
	ResourceUser         = "user"
	ResourceAssignment   = "assignment"
	ResourceSubmission   = "submission"
	ResourceQuiz         = "quiz"
	ResourceGrade        = "grade"
	ResourceAnnouncement = "announcement"
	ResourceFile         = "file"
)

// TableName returns table name
func (Policy) TableName() string      { return "policies" }
func (PolicyAudit) TableName() string { return "policy_audits" }

// IsAllowed checks if policy effect is allow
func (p *Policy) IsAllowed() bool {
	return p.Effect == "allow"
}

// MatchAction checks if policy action matches the given action
func (p *Policy) MatchAction(action string) bool {
	if p.Action == ActionAll {
		return true
	}
	if p.Action == action {
		return true
	}
	// Check prefix match (e.g., "course:" matches "course:create")
	if len(p.Action) > 0 && p.Action[len(p.Action)-1] == ':' {
		return len(action) > len(p.Action) && action[:len(p.Action)] == p.Action
	}
	return false
}

// MatchResource checks if policy resource matches
func (p *Policy) MatchResource(resourceType string) bool {
	return p.Resource == resourceType || p.Resource == "*"
}

// MatchRole checks if user role matches policy role filter
func (p *Policy) MatchRole(userRoles []string) bool {
	if p.RoleFilter == "" {
		return true // No role filter = all roles
	}
	for _, role := range userRoles {
		if role == p.RoleFilter {
			return true
		}
	}
	return false
}

// DefaultPolicies returns default policies for local development
func DefaultPolicies() []Policy {
	return []Policy{
		// Instructors can manage courses
		{
			ID:     uuid.MustParse("00000000-0000-0000-0000-000000000101"),
			Action: "course:*", Resource: "course", Effect: "allow",
			RoleFilter: "instructor", Priority: 100,
		},
		// Students can view courses
		{
			ID:     uuid.MustParse("00000000-0000-0000-0000-000000000102"),
			Action: "course:read", Resource: "course", Effect: "allow",
			RoleFilter: "student", Priority: 50,
		},
		// Students can submit assignments
		{
			ID:     uuid.MustParse("00000000-0000-0000-0000-000000000103"),
			Action: "submission:create", Resource: "submission", Effect: "allow",
			RoleFilter: "student", Priority: 50,
		},
		// Admins can manage users
		{
			ID:     uuid.MustParse("00000000-0000-0000-0000-000000000104"),
			Action: "user:*", Resource: "user", Effect: "allow",
			RoleFilter: "admin", Priority: 100,
		},
		// Super admins can do everything
		{
			ID:     uuid.MustParse("00000000-0000-0000-0000-000000000105"),
			Action: "*", Resource: "*", Effect: "allow",
			RoleFilter: "super_admin", Priority: 200,
		},
		// TAs can view and grade
		{
			ID:     uuid.MustParse("00000000-0000-0000-0000-000000000106"),
			Action: "submission:read", Resource: "submission", Effect: "allow",
			RoleFilter: "ta", Priority: 50,
		},
	}
}
