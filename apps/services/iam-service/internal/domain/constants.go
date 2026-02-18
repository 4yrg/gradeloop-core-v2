package domain

// Roles
const (
	RoleSuperAdmin = "SUPER_ADMIN"
	RoleAdmin      = "ADMIN"
	RoleInstructor = "INSTRUCTOR"
	RoleStudent    = "STUDENT"
)

// Permissions - Canonical IAM format (service:resource:action)
// Legacy constants kept for backward compatibility during migration
const (
	// Legacy format (deprecated - use canonical format)
	PermissionUserCreate = "USER_CREATE"
	PermissionUserRead   = "USER_READ"
	PermissionUserUpdate = "USER_UPDATE"
	PermissionUserDelete = "USER_DELETE"

	PermissionRoleCreate = "ROLE_CREATE"
	PermissionRoleRead   = "ROLE_READ"
	PermissionRoleUpdate = "ROLE_UPDATE"
	PermissionRoleDelete = "ROLE_DELETE"
	PermissionRoleAssign = "ROLE_ASSIGN"

	PermissionAuditRead = "AUDIT_READ"

	// Canonical format (iam:resource:action)
	PermissionUsersCreate = "iam:users:create"
	PermissionUsersRead   = "iam:users:read"
	PermissionUsersUpdate = "iam:users:update"
	PermissionUsersDelete = "iam:users:delete"

	PermissionRolesCreate = "iam:roles:create"
	PermissionRolesRead   = "iam:roles:read"
	PermissionRolesUpdate = "iam:roles:update"
	PermissionRolesDelete = "iam:roles:delete"
	PermissionRolesAssign = "iam:roles:assign"

	PermissionAuditReadCanonical = "iam:audit:read"
)
