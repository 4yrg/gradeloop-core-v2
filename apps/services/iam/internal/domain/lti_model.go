package domain

import (
	"time"

	"github.com/google/uuid"
)

// LTILaunch represents an LTI launch session
type LTILaunch struct {
	ID             uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	TenantID       uuid.UUID `gorm:"type:uuid;index" json:"tenant_id"`
	ToolID         uuid.UUID `gorm:"type:uuid;index" json:"tool_id"`
	DeploymentID   string    `gorm:"size:255;index" json:"deployment_id"`
	ContextID      string    `gorm:"size:255" json:"context_id"`       // LTI context (course)
	ResourceLinkID string    `gorm:"size:255" json:"resource_link_id"` // Assignment/quiz
	UserID         uuid.UUID `gorm:"type:uuid;index" json:"user_id"`
	User           User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Roles          string    `gorm:"size:50" json:"roles"` // LTI role
	Nonce          string    `gorm:"size:255" json:"nonce"`
	State          string    `gorm:"size:255" json:"state"`
	ExpiresAt      time.Time `gorm:"index" json:"expires_at"`
	CreatedAt      time.Time `json:"created_at"`
}

// LTITool represents a registered external LTI tool
type LTITool struct {
	ID            uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	ClientID      string    `gorm:"uniqueIndex" json:"client_id"`
	DeploymentID  string    `gorm:"size:255;index" json:"deployment_id"`
	Issuer        string    `gorm:"size:255;index" json:"issuer"`
	Name          string    `gorm:"size:255" json:"name"`
	Description   string    `gorm:"type:text" json:"description,omitempty"`
	KeysetURL     string    `gorm:"size:512" json:"keyset_url"`
	RedirectURIs  string    `gorm:"type:text" json:"redirect_uris"` // JSON array
	TargetLinkURI string    `gorm:"size:512" json:"target_link_uri"`
	PublicKey     string    `gorm:"type:text" json:"public_key,omitempty"`
	JWKS          string    `gorm:"type:text" json:"jwks,omitempty"` // Cached JWKS
	IsActive      bool      `gorm:"default:true" json:"is_active"`
	TenantID      uuid.UUID `gorm:"type:uuid;index" json:"tenant_id"`
	PlatformType  string    `gorm:"size:50" json:"platform_type"` // "canvas", "moodle", "blackboard"
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// LTIDeployment represents a tool deployment
type LTIDeployment struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	ToolID       uuid.UUID `gorm:"type:uuid;index" json:"tool_id"`
	TenantID     uuid.UUID `gorm:"type:uuid;index" json:"tenant_id"`
	DeploymentID string    `gorm:"uniqueIndex:deployment" json:"deployment_id"`
	Issuer       string    `gorm:"size:255;index" json:"issuer"`
	IsActive     bool      `gorm:"default:true" json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// LTIContext represents LTI context (course) mapping
type LTIContext struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	TenantID  uuid.UUID `gorm:"type:uuid;index" json:"tenant_id"`
	ContextID string    `gorm:"size:255;uniqueIndex:context" json:"context_id"` // External LMS course ID
	CourseID  uuid.UUID `gorm:"type:uuid" json:"course_id"`                     // Internal course
	Tenant    Tenant    `gorm:"foreignKey:TenantID" json:"tenant,omitempty"`
	Title     string    `gorm:"size:255" json:"title"`
	Label     string    `gorm:"size:50" json:"label"`
	Type      string    `gorm:"size:50" json:"type"`                 // "course", "group", "module"
	Settings  string    `gorm:"type:text" json:"settings,omitempty"` // JSON
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// LTILineItem represents AGS line item
type LTILineItem struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	TenantID    uuid.UUID `gorm:"type:uuid;index" json:"tenant_id"`
	ToolID      uuid.UUID `gorm:"type:uuid;index" json:"tool_id"`
	ContextID   string    `gorm:"size:255;index" json:"context_id"`
	LineItemID  string    `gorm:"size:255" json:"line_item_id"` // External LMS line item ID
	ResourceID  string    `gorm:"size:255" json:"resource_id"`
	Tag         string    `gorm:"size:100" json:"tag"` // e.g., "quiz-1"
	Title       string    `gorm:"size:255" json:"title"`
	ScoreMax    float64   `json:"score_max"`
	ScoreMin    float64   `json:"score_min"`
	ExternalURL string    `gorm:"size:512" json:"external_url"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// LTIScore represents a grade
type LTIScore struct {
	ID         uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	TenantID   uuid.UUID `gorm:"type:uuid;index" json:"tenant_id"`
	LineItemID uuid.UUID `gorm:"type:uuid;index" json:"line_item_id"`
	UserID     uuid.UUID `gorm:"type:uuid;index" json:"user_id"`
	ScoreOf    uuid.UUID `gorm:"type:uuid" json:"score_of"`
	// LMS-side data
	ExternalUserID string    `gorm:"size:255" json:"external_user_id"`
	ScoreGiven     float64   `json:"score_given"`
	ScoreMax       float64   `json:"score_max"`
	Timestamp      time.Time `gorm:"index" json:"timestamp"`
	Comment        string    `gorm:"type:text" json:"comment,omitempty"`
	Progress       string    `gorm:"size:50" json:"progress"` // "FullyGraded", "Pending"
	CreatedAt      time.Time `json:"created_at"`
}

// LTI1p1Launch represents legacy LTI 1.1 launch data
type LTI1p1Launch struct {
	ID             uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	TenantID       uuid.UUID `gorm:"type:uuid;index" json:"tenant_id"`
	ToolID         uuid.UUID `gorm:"type:uuid;index" json:"tool_id"`
	ContextID      string    `gorm:"size:255" json:"context_id"`
	ResourceLinkID string    `gorm:"size:255" json:"resource_link_id"`
	UserID         uuid.UUID `gorm:"type:uuid;index" json:"user_id"`
	Roles          string    `gorm:"size:255" json:"roles"`
	OAuthConsumer  string    `gorm:"size:255" json:"oauth_consumer"`
	Nonce          string    `gorm:"size:255" json:"nonce"`
	Signature      string    `gorm:"size:255" json:"signature"`
	ExpiresAt      time.Time `gorm:"index" json:"expires_at"`
	CreatedAt      time.Time `json:"created_at"`
}

// LTI Role constants
const (
	LTIRoleAdministrator = "http://purl.imsglobal.org/vocab/lti/v1/role#Administrator"
	LTIRoleInstructor    = "http://purl.imsglobal.org/vocab/lti/v1/role#Instructor"
	LTIRoleContentDev    = "http://purl.imsglobal.org/vocab/lti/v1/role#ContentDeveloper"
	LTIRoleMentor        = "http://purl.imsglobal.org/vocab/lti/v1/role#Mentor"
	LTIRoleTeacher       = "http://purl.imsglobal.org/vocab/lti/v1/role#Teacher"
	LTIRoleLearner       = "http://purl.imsglobal.org/vocab/lti/v1/role#Learner"
	LTIRoleStudent       = "http://purl.imsglobal.org/vocab/lti/v1/role#Student"
	LTIRoleTA            = "http://purl.imsglobal.org/vocab/lti/v1/role#TA"
)

// TableName returns table name
func (LTITool) TableName() string       { return "lti_tools" }
func (LTIDeployment) TableName() string { return "lti_deployments" }
func (LTIContext) TableName() string    { return "lti_contexts" }
func (LTILineItem) TableName() string   { return "lti_line_items" }
func (LTIScore) TableName() string      { return "lti_scores" }
func (LTILaunch) TableName() string     { return "lti_launches" }
func (LTI1p1Launch) TableName() string  { return "lti_1p1_launches" }

// ToIAMRole converts LTI role to IAM UserType
func (l *LTILaunch) ToIAMRole() string {
	switch l.Roles {
	case LTIRoleAdministrator, LTIRoleContentDev, LTIRoleMentor, LTIRoleTeacher:
		return UserTypeInstructor
	case LTIRoleTA:
		return "ta"
	case LTIRoleLearner, LTIRoleStudent:
		return UserTypeStudent
	default:
		return UserTypeStudent
	}
}
