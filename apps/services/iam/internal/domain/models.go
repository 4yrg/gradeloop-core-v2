package domain

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// UserType constants
const (
	UserTypeStudent    = "student"
	UserTypeInstructor = "instructor"
	UserTypeAdmin      = "admin"
	UserTypeSuperAdmin = "super_admin"
)

// Valid user types
var ValidUserTypes = []string{
	UserTypeStudent,
	UserTypeInstructor,
	UserTypeAdmin,
	UserTypeSuperAdmin,
}

type User struct {
	ID                      uuid.UUID      `gorm:"type:uuid;primarykey" json:"id"`
	Email                   string         `gorm:"uniqueIndex:idx_users_email,where:deleted_at IS NULL;not null;size:255" json:"email"`
	FullName                string         `gorm:"size:255" json:"full_name"`
	AvatarURL               string         `gorm:"size:512" json:"avatar_url"`
	Faculty                 string         `gorm:"size:255" json:"faculty"`
	Department              string         `gorm:"size:255" json:"department"`
	PasswordHash            string         `gorm:"size:255" json:"-"`
	KeycloakID              string         `gorm:"size:255" json:"keycloak_id,omitempty"`
	TenantID                uuid.UUID      `gorm:"type:uuid" json:"tenant_id,omitempty"`
	UserType                string         `gorm:"not null;size:20;index" json:"user_type"`
	IsActive                bool           `gorm:"not null;default:true" json:"is_active"`
	IsPasswordResetRequired bool           `gorm:"not null;default:false" json:"is_password_reset_required"`
	EmailVerified           bool           `gorm:"not null;default:false" json:"email_verified"`
	PasswordSetAt           *time.Time     `json:"password_set_at,omitempty"`
	DeletedAt               gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
	CreatedAt               time.Time      `json:"created_at"`
	UpdatedAt               time.Time      `json:"updated_at"`
}

type UserProfileStudent struct {
	UserID    uuid.UUID `gorm:"type:uuid;primaryKey" json:"user_id"`
	StudentID string    `gorm:"uniqueIndex;not null;size:50" json:"student_id"`
	User      User      `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"user,omitempty"`
}

type UserProfileInstructor struct {
	UserID      uuid.UUID `gorm:"type:uuid;primaryKey" json:"user_id"`
	Designation string    `gorm:"not null;size:100" json:"designation"`
	User        User      `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"user,omitempty"`
}

type ProfileData struct {
	StudentID   string
	Designation string
}

type RefreshToken struct {
	ID        uuid.UUID  `gorm:"type:uuid;primarykey" json:"id"`
	UserID    uuid.UUID  `gorm:"type:uuid;not null;index" json:"user_id"`
	User      User       `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"user,omitempty"`
	TokenHash string     `gorm:"uniqueIndex;not null;size:255" json:"-"`
	ExpiresAt time.Time  `gorm:"not null;index" json:"expires_at"`
	RevokedAt *time.Time `gorm:"index" json:"revoked_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}

type PasswordResetToken struct {
	ID        uuid.UUID  `gorm:"type:uuid;primarykey" json:"id"`
	UserID    uuid.UUID  `gorm:"type:uuid;not null;index" json:"user_id"`
	User      User       `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"user,omitempty"`
	TokenHash string     `gorm:"uniqueIndex;not null;size:255" json:"-"`
	ExpiresAt time.Time  `gorm:"not null;index" json:"expires_at"`
	UsedAt    *time.Time `gorm:"index" json:"used_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}

// ActivityLog represents a user audit log entry
type ActivityLog struct {
	ID          uuid.UUID      `gorm:"type:uuid;primarykey" json:"id"`
	UserID      uuid.UUID      `gorm:"type:uuid;not null;index" json:"user_id"`
	Action      string         `gorm:"not null;size:100" json:"action"`
	Description string         `gorm:"not null;size:512" json:"description"`
	EntityType  string         `gorm:"size:50" json:"entity_type,omitempty"`
	EntityID    string         `gorm:"size:100" json:"entity_id,omitempty"`
	Metadata    string         `gorm:"type:jsonb" json:"metadata,omitempty"` // stored as JSON string/JSONB
	IPAddress   string         `gorm:"size:45" json:"ip_address,omitempty"`
	UserAgent   string         `gorm:"size:512" json:"user_agent,omitempty"`
	CreatedAt   time.Time      `json:"created_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// User helper methods

// InvitationStatus constants
const (
	InvitationStatusPending  = "pending"
	InvitationStatusUsed   = "used"
	InvitationStatusExpired = "expired"
	InvitationStatusCancelled = "cancelled"
)

// Invitation represents an invitation to join the LMS
type Invitation struct {
	ID            uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	TenantID      uuid.UUID     `gorm:"type:uuid;index" json:"tenant_id"`
	Email        string       `gorm:"not null;size:255;index" json:"email"`
	Role         string       `gorm:"not null;size:50" json:"role"` // student, instructor, admin
	FullName     string       `gorm:"size:255" json:"full_name"`
	Department   string       `gorm:"size:255" json:"department,omitempty"`
	Batch       string       `gorm:"size:50" json:"batch,omitempty"`
	InvitationCode string   `gorm:"uniqueIndex;size:50" json:"invitation_code"`
	Status      string       `gorm:"not null;size:20;default:pending" json:"status"`
	ExpiresAt    time.Time   `gorm:"not null;index" json:"expires_at"`
	AcceptedAt   *time.Time `json:"accepted_at,omitempty"`
	InvitedBy    uuid.UUID   `gorm:"type:uuid;index" json:"invited_by"`
	CreatedAt    time.Time  `json:"created_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName returns table name
func (Invitation) TableName() string { return "invitations" }

// IsExpired checks if invitation has expired
func (i *Invitation) IsExpired() bool {
	return time.Now().After(i.ExpiresAt)
}

// IsValid checks if invitation is valid
func (i *Invitation) IsValid() bool {
	return i.Status == InvitationStatusPending && !i.IsExpired()
}

// Role represents a user role
type Role struct {
	ID          uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	TenantID    uuid.UUID     `gorm:"type:uuid;index" json:"tenant_id"`
	Name       string       `gorm:"not null;size:50;uniqueIndex:idx_roles_tenant" json:"name"`
	Description string     `gorm:"size:255" json:"description"`
	IsDefault  bool         `gorm:"default:false" json:"is_default"`
	IsSystem   bool         `gorm:"default:false" json:"is_system"` // system roles cannot be deleted
	Permissions []string   `gorm:"-" json:"permissions,omitempty"`
	CreatedAt  time.Time   `json:"created_at"`
	UpdatedAt  time.Time   `json:"updated_at"`
}

// Permission represents a permission
type Permission struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	Action      string   `gorm:"not null;size:100;uniqueIndex" json:"action"`
	Resource   string   `gorm:"not null;size:100" json:"resource"`
	Description string `gorm:"size:255" json:"description"`
	Category   string   `gorm:"size:50" json:"category"` // auth, user, course, assignment, etc.
	CreatedAt  time.Time `json:"created_at"`
}

// UserRole represents the role assigned to a user
type UserRole struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	UserID    uuid.UUID `gorm:"type:uuid;index" json:"user_id"`
	RoleID   uuid.UUID `gorm:"type:uuid;index" json:"role_id"`
	TenantID uuid.UUID `gorm:"type:uuid;index" json:"tenant_id"`
	IsPrimary bool   `gorm:"default:false" json:"is_primary"`
	AssignedAt time.Time `json:"assigned_at"`
	AssignedBy uuid.UUID `json:"assigned_by"`
}

// RolePermission represents permissions assigned to a role
type RolePermission struct {
	ID          uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	RoleID     uuid.UUID `gorm:"type:uuid;index" json:"role_id"`
	PermissionID uuid.UUID `gorm:"type:uuid;index" json:"permission_id"`
	CreatedAt  time.Time `json:"created_at"`
}

// TableName returns table name
func (Role) TableName() string { return "roles" }
func (Permission) TableName() string { return "permissions" }
func (UserRole) TableName() string { return "user_roles" }
func (RolePermission) TableName() string { return "role_permissions" }

// DefaultRoles returns default roles for a tenant
func DefaultRoles(tenantID uuid.UUID) []Role {
	return []Role{
		{
			ID:          uuid.MustParse("00000000-0000-0000-0000-000000001001"),
			TenantID:    tenantID,
			Name:       "student",
			Description: "Student role with basic access",
			IsSystem:   true,
		},
		{
			ID:          uuid.MustParse("00000000-0000-0000-0000-000000001002"),
			TenantID:    tenantID,
			Name:       "instructor",
			Description: "Instructor role with teaching privileges",
			IsSystem:   true,
		},
		{
			ID:          uuid.MustParse("00000000-0000-0000-0000-000000001003"),
			TenantID:    tenantID,
			Name:       "admin",
			Description: "Admin role with management privileges",
			IsSystem:   true,
		},
		{
			ID:          uuid.MustParse("00000000-0000-0000-0000-000000001004"),
			TenantID:    tenantID,
			Name:       "super_admin",
			Description: "Super admin with platform-wide access",
			IsSystem:   true,
		},
	}
}

// DefaultPermissions returns default permissions
func DefaultPermissions() []Permission {
	return []Permission{
		// Auth permissions
		{ID: uuid.MustParse("00000000-0000-0000-0000-000000002001"), Action: "auth:login", Resource: "auth", Description: "Login to the system", Category: "auth"},
		{ID: uuid.MustParse("00000000-0000-0000-0000-000000002002"), Action: "auth:logout", Resource: "auth", Description: "Logout from the system", Category: "auth"},
		{ID: uuid.MustParse("00000000-0000-0000-0000-000000002003"), Action: "auth:change-password", Resource: "auth", Description: "Change password", Category: "auth"},

		// User permissions
		{ID: uuid.MustParse("00000000-0000-0000-0000-000000002010"), Action: "user:read", Resource: "user", Description: "View users", Category: "user"},
		{ID: uuid.MustParse("00000000-0000-0000-0000-000000002011"), Action: "user:create", Resource: "user", Description: "Create users", Category: "user"},
		{ID: uuid.MustParse("00000000-0000-0000-0000-000000002012"), Action: "user:update", Resource: "user", Description: "Update users", Category: "user"},
		{ID: uuid.MustParse("00000000-0000-0000-0000-000000002013"), Action: "user:delete", Resource: "user", Description: "Delete users", Category: "user"},
		{ID: uuid.MustParse("00000000-0000-0000-0000-000000002014"), Action: "user:invite", Resource: "user", Description: "Invite users", Category: "user"},

		// Tenant permissions
		{ID: uuid.MustParse("00000000-0000-0000-0000-000000002020"), Action: "tenant:read", Resource: "tenant", Description: "View tenants", Category: "tenant"},
		{ID: uuid.MustParse("00000000-0000-0000-0000-000000002021"), Action: "tenant:create", Resource: "tenant", Description: "Create tenants", Category: "tenant"},
		{ID: uuid.MustParse("00000000-0000-0000-0000-000000002022"), Action: "tenant:update", Resource: "tenant", Description: "Update tenants", Category: "tenant"},
		{ID: uuid.MustParse("00000000-0000-0000-0000-000000002023"), Action: "tenant:delete", Resource: "tenant", Description: "Delete tenants", Category: "tenant"},

		// Role permissions
		{ID: uuid.MustParse("00000000-0000-0000-0000-000000002030"), Action: "role:read", Resource: "role", Description: "View roles", Category: "role"},
		{ID: uuid.MustParse("00000000-0000-0000-0000-000000002031"), Action: "role:create", Resource: "role", Description: "Create roles", Category: "role"},
		{ID: uuid.MustParse("00000000-0000-0000-0000-000000002032"), Action: "role:update", Resource: "role", Description: "Update roles", Category: "role"},
		{ID: uuid.MustParse("00000000-0000-0000-0000-000000002033"), Action: "role:delete", Resource: "role", Description: "Delete roles", Category: "role"},
	}
}

// IsValidUserType checks if the given user type is valid
func IsValidUserType(userType string) bool {
	for _, validType := range ValidUserTypes {
		if validType == userType {
			return true
		}
	}
	return false
}

// HasAdminAccess returns true if the user has admin or super_admin access
func (u *User) HasAdminAccess() bool {
	return u.UserType == UserTypeAdmin || u.UserType == UserTypeSuperAdmin
}

// IsSuperAdmin returns true if the user is a super admin
func (u *User) IsSuperAdmin() bool {
	return u.UserType == UserTypeSuperAdmin
}

// IsStudent returns true if the user is a student
func (u *User) IsStudent() bool {
	return u.UserType == UserTypeStudent
}

// IsInstructor returns true if the user is an instructor
func (u *User) IsInstructor() bool {
	return u.UserType == UserTypeInstructor
}

// MFAStatus constants
const (
	MFAStatusDisabled = "disabled"
	MFAStatusPending = "pending"
	MFAStatusEnabled = "enabled"
)

// MFAConfig represents a user's MFA configuration
type MFAConfig struct {
	ID           uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	UserID       uuid.UUID `gorm:"type:uuid;uniqueIndex" json:"user_id"`
	Secret       string   `gorm:"size:255" json:"secret,omitempty"` // encrypted TOTP secret
	RecoveryCodes []string `gorm:"type:text" json:"recovery_codes,omitempty"` // encrypted recovery codes
	Status      string   `gorm:"not null;size:20;default:disabled" json:"status"`
	EnabledAt    *time.Time `json:"enabled_at,omitempty"`
	LastVerifiedAt *time.Time `json:"last_verified_at,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// TableName returns table name
func (MFAConfig) TableName() string { return "mfa_configs" }

// IsEnabled checks if MFA is enabled
func (m *MFAConfig) IsEnabled() bool {
	return m.Status == MFAStatusEnabled
}
