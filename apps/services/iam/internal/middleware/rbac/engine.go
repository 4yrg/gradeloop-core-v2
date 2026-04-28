package rbac

import (
	"fmt"
	"strings"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/middleware/identity"
)

// Permission represents a permission in the system
type Permission struct {
	Resource string // e.g., "course", "user", "submission"
	Action   string // e.g., "read", "write", "delete", "*"
}

// PermissionList is a list of permissions
type PermissionList []Permission

// Has checks if the permission list contains a specific permission
func (pl PermissionList) Has(resource, action string) bool {
	for _, p := range pl {
		if p.Resource == resource && (p.Action == action || p.Action == "*") {
			return true
		}
	}
	return false
}

// String returns string representation
func (p Permission) String() string {
	return fmt.Sprintf("%s:%s", p.Resource, p.Action)
}

// RBACEngine enforces permissions based on roles
// STRICT mode - no bypass in local (Option B)
type RBACEngine struct {
	policies map[string]PermissionList
	env      string
}

// NewRBACEngine creates a new RBAC engine
func NewRBACEngine(env string) *RBACEngine {
	engine := &RBACEngine{
		policies: make(map[string]PermissionList),
		env:      env,
	}

	// Register default policies
	engine.registerDefaultPolicies()

	return engine
}

// registerDefaultPolicies registers the default role-permission mappings
func (e *RBACEngine) registerDefaultPolicies() {
	// Student permissions
	e.policies["student"] = PermissionList{
		{Resource: "course", Action: "read"},
		{Resource: "submission", Action: "create"},
		{Resource: "submission", Action: "read"},
		{Resource: "submission", Action: "read:own"},
		{Resource: "profile", Action: "read"},
		{Resource: "profile", Action: "write"},
		{Resource: "profile", Action: "write:own"},
		{Resource: "enrollment", Action: "read"},
		{Resource: "enrollment", Action: "read:own"},
	}

	// TA (Teaching Assistant) permissions
	e.policies["ta"] = PermissionList{
		{Resource: "course", Action: "read"},
		{Resource: "submission", Action: "read"},
		{Resource: "submission", Action: "feedback"},
		{Resource: "submission", Action: "read:course"},
		{Resource: "profile", Action: "read"},
		{Resource: "profile", Action: "write"},
		{Resource: "enrollment", Action: "read"},
		{Resource: "enrollment", Action: "read:course"},
	}

	// Instructor permissions
	e.policies["instructor"] = PermissionList{
		{Resource: "course", Action: "read"},
		{Resource: "course", Action: "write"},
		{Resource: "course", Action: "read:own"},
		{Resource: "course", Action: "write:own"},
		{Resource: "assignment", Action: "read"},
		{Resource: "assignment", Action: "write"},
		{Resource: "assignment", Action: "read:own"},
		{Resource: "assignment", Action: "write:own"},
		{Resource: "submission", Action: "read"},
		{Resource: "submission", Action: "grade"},
		{Resource: "submission", Action: "read:course"},
		{Resource: "submission", Action: "read:own"},
		{Resource: "enrollment", Action: "read"},
		{Resource: "enrollment", Action: "read:course"},
		{Resource: "enrollment", Action: "write:own"},
		{Resource: "user", Action: "read"},
		{Resource: "profile", Action: "read"},
		{Resource: "profile", Action: "write"},
	}

	// Admin permissions (tenant-level)
	e.policies["admin"] = PermissionList{
		{Resource: "*", Action: "read"},
		{Resource: "course", Action: "*"},
		{Resource: "user", Action: "read"},
		{Resource: "user", Action: "write"},
		{Resource: "enrollment", Action: "*"},
		{Resource: "submission", Action: "*"},
		{Resource: "faculty", Action: "*"},
		{Resource: "department", Action: "*"},
		{Resource: "assignment", Action: "*"},
		{Resource: "tenant", Action: "read"},
		{Resource: "tenant", Action: "write"},
	}

	// Super Admin permissions (platform-level)
	e.policies["super_admin"] = PermissionList{
		{Resource: "*", Action: "*"},
	}
}

// Authorize checks if the identity has permission to perform the action
// action format: "resource:action" e.g., "course:write"
func (e *RBACEngine) Authorize(ctx *identity.Context, action string) bool {
	if ctx == nil {
		return false
	}

	// Parse action into resource and action parts
	resource, actionPart := parseAction(action)
	if resource == "" {
		return false
	}

	// Check each role the user has
	for _, role := range ctx.Roles {
		perms, ok := e.policies[role]
		if !ok {
			continue
		}

		if perms.Has(resource, actionPart) {
			return true
		}
	}

	return false
}

// HasPermission checks if identity has specific permission
func (e *RBACEngine) HasPermission(ctx *identity.Context, resource, action string) bool {
	return e.Authorize(ctx, resource+":"+action)
}

// GetPermissionsByRole returns all permissions for a role
func (e *RBACEngine) GetPermissionsByRole(role string) PermissionList {
	return e.policies[role]
}

// GetAllPermissionsForIdentity returns all permissions for an identity
func (e *RBACEngine) GetAllPermissionsForIdentity(ctx *identity.Context) PermissionList {
	if ctx == nil {
		return nil
	}

	var allPerms PermissionList
	for _, role := range ctx.Roles {
		allPerms = append(allPerms, e.policies[role]...)
	}

	return allPerms
}

// RegisterPolicy adds or updates a policy for a role
func (e *RBACEngine) RegisterPolicy(role string, perms PermissionList) {
	e.policies[role] = perms
}

// Evaluate is an alias for Authorize (for interface compliance)
func (e *RBACEngine) Evaluate(ctx *identity.Context, action string) bool {
	return e.Authorize(ctx, action)
}

// parseAction parses "resource:action" string into parts
func parseAction(action string) (string, string) {
	parts := strings.Split(action, ":")
	if len(parts) == 2 {
		return parts[0], parts[1]
	}
	// If no colon, treat entire string as resource with wildcard action
	return action, "*"
}

// RequirePermission creates middleware that checks for specific permission
func RequirePermission(engine *RBACEngine, resource, action string) func(c interface{}) error {
	return func(c interface{}) error {
		ctx, ok := c.(interface{ Locals(key string) interface{} })
		if !ok {
			return fmt.Errorf("invalid context type")
		}

		id, ok := ctx.Locals("identity").(*identity.Context)
		if !ok || id == nil {
			return fmt.Errorf("identity not found in context")
		}

		if !engine.HasPermission(id, resource, action) {
			return fmt.Errorf("permission denied: %s:%s", resource, action)
		}

		// Continue to next handler
		if next, ok := c.(interface{ Next() error }); ok {
			return next.Next()
		}
		return nil
	}
}

// RequireRole is backward compatible with existing middleware
// Uses RBAC engine internally now
func RequireRole(roles ...string) func(c interface{}) error {
	return func(c interface{}) error {
		ctx, ok := c.(interface{ Locals(key string) interface{} })
		if !ok {
			return fmt.Errorf("invalid context type")
		}

		id, ok := ctx.Locals("identity").(*identity.Context)
		if !ok || id == nil {
			return fmt.Errorf("identity not found in context")
		}

		if !id.HasRole(roles...) {
			return fmt.Errorf("insufficient privileges")
		}

		if next, ok := c.(interface{ Next() error }); ok {
			return next.Next()
		}
		return nil
	}
}
