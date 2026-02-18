/**
 * Gradeloop Permission System Types
 *
 * Permission strings follow the hierarchical pattern:
 * service:component:action
 *
 * Examples:
 * - iam:users:read
 * - iam:sessions:write
 * - iam:posts:delete
 * - iam:*:read (wildcard component)
 * - iam:users:* (full users access)
 * - *:*:* (superadmin - all permissions)
 */

// ============================================================================
// Service Definitions
// ============================================================================

/** Known services */
export type Service =
  | "iam"
  | "dashboard"
  | "auth"
  | "content"
  | "users"
  | "analytics"
  | "settings"
  | "admin"
  | "courses"
  | "assignments"
  | "grading"
  | "reports"
  | "institution"
  | "academics"
  | "bulk-import"
  | "roles"
  | "audit";

/** Wildcard service matcher */
export type AnyService = "*";

// ============================================================================
// Component/Resource Definitions by Service
// ============================================================================

/** IAM service resources */
export type IAMResource =
  | "users"
  | "roles"
  | "permissions"
  | "sessions"
  | "audit-logs";

/** Dashboard service resources */
export type DashboardResource =
  | "users"
  | "analytics"
  | "settings"
  | "overview"
  | "widgets";

/** Auth service resources */
export type AuthResource = "sessions" | "tokens" | "passwords" | "mfa";

/** Content service resources */
export type ContentResource =
  | "posts"
  | "pages"
  | "media"
  | "comments"
  | "categories";

/** Analytics service resources */
export type AnalyticsResource =
  | "reports"
  | "metrics"
  | "dashboards"
  | "exports";

/** Settings service resources */
export type SettingsResource =
  | "general"
  | "security"
  | "notifications"
  | "integrations";

/** Admin service resources */
export type AdminResource =
  | "users"
  | "roles"
  | "permissions"
  | "audit-logs"
  | "system";

/** Courses service resources */
export type CoursesResource =
  | "courses"
  | "enrollments"
  | "curriculum"
  | "materials";

/** Assignments service resources */
export type AssignmentsResource =
  | "assignments"
  | "submissions"
  | "feedback"
  | "rubrics";

/** Grading service resources */
export type GradingResource = "grades" | "scales" | "transcripts" | "gpa";

/** Reports service resources */
export type ReportsResource = "reports" | "exports" | "scheduled";

/** Institution service resources */
export type InstitutionResource =
  | "institution"
  | "departments"
  | "programs"
  | "terms";

/** Academics service resources */
export type AcademicsResource =
  | "faculties"
  | "departments"
  | "programs"
  | "courses"
  | "terms";

/** Bulk import service resources */
export type BulkImportResource = "imports" | "mappings" | "templates";

/** Roles service resources */
export type RolesResource = "roles" | "permissions" | "assignments";

/** Audit service resources */
export type AuditResource = "logs" | "trails" | "reports";

/** Generic fallback for unknown resources */
export type GenericResource = string;

// ============================================================================
// Action Definitions
// ============================================================================

/** CRUD actions */
export type CrudAction = "read" | "write" | "update" | "delete" | "create";

/** Extended actions */
export type ExtendedAction =
  | "read"
  | "write"
  | "update"
  | "delete"
  | "create"
  | "approve"
  | "reject"
  | "publish"
  | "archive"
  | "restore"
  | "export"
  | "import"
  | "share"
  | "assign"
  | "revoke"
  | "manage"
  | "configure"
  | "view"
  | "edit"
  | "moderate"
  | "grade"
  | "submit"
  | "review";

/** Wildcard action matcher */
export type AnyAction = "*";

// ============================================================================
// Permission String Types
// ============================================================================

/**
 * Strict permission string type for known service:component:action combinations
 * Format: service:component:action
 */
export type StrictPermission =
  | `iam:${IAMResource}:${ExtendedAction}`
  | `dashboard:${DashboardResource}:${ExtendedAction}`
  | `auth:${AuthResource}:${ExtendedAction}`
  | `content:${ContentResource}:${ExtendedAction}`
  | `analytics:${AnalyticsResource}:${ExtendedAction}`
  | `settings:${SettingsResource}:${ExtendedAction}`
  | `admin:${AdminResource}:${ExtendedAction}`
  | `courses:${CoursesResource}:${ExtendedAction}`
  | `assignments:${AssignmentsResource}:${ExtendedAction}`
  | `grading:${GradingResource}:${ExtendedAction}`
  | `reports:${ReportsResource}:${ExtendedAction}`
  | `institution:${InstitutionResource}:${ExtendedAction}`
  | `academics:${AcademicsResource}:${ExtendedAction}`
  | `bulk-import:${BulkImportResource}:${ExtendedAction}`
  | `roles:${RolesResource}:${ExtendedAction}`
  | `audit:${AuditResource}:${ExtendedAction}`;

/**
 * Wildcard permission types
 * Format: *:*:* or service:*:* or service:component:*
 */
export type WildcardPermission =
  | `${AnyService}:${string}:${AnyAction}`
  | `${AnyService}:${string}:${string}`
  | `${AnyService}:${AnyAction}:${AnyAction}`;

/**
 * Generic permission string type for extensibility
 * Allows any string matching the service:component:action pattern
 */
export type GenericPermission = `${string}:${string}:${string}`;

/**
 * Main Permission type - union of all permission formats
 * Provides autocomplete for known permissions while allowing extensibility
 */
export type Permission =
  | StrictPermission
  | WildcardPermission
  | GenericPermission
  | string; // Fallback for maximum flexibility

// ============================================================================
// Permission Array Types
// ============================================================================

/** Single permission or array of permissions */
export type PermissionInput = Permission | Permission[];

/** Permission check mode */
export type PermissionMode = "any" | "all";

// ============================================================================
// Permission Check Result Types
// ============================================================================

/** Result of a permission check */
export interface PermissionCheckResult {
  /** Whether the permission check passed */
  allowed: boolean;
  /** The permission(s) that were checked */
  required: Permission | Permission[];
  /** The mode used for array checks */
  mode?: PermissionMode;
  /** Which user permission matched (if any) */
  matchedPermission?: string;
}

// ============================================================================
// Navigation Permission Types
// ============================================================================

/** Permission configuration for navigation items */
export interface NavPermissionConfig {
  /** Single permission or array of permissions required */
  permission?: Permission | Permission[];
  /** Mode for array permissions: "any" (OR) or "all" (AND) */
  permissionMode?: PermissionMode;
  /** Hide from navigation but allow direct route access */
  hideFromNav?: boolean;
}

// ============================================================================
// Permission Guard Props Types
// ============================================================================

/** Props for PermissionGuard component */
export interface PermissionGuardProps {
  /** Single permission or array of permissions required */
  require?: Permission | Permission[];
  /** Mode for array permissions (default: "any") */
  mode?: PermissionMode;
  /** Children to render if permission check passes */
  children: React.ReactNode;
  /** Fallback to render if permission check fails (default: null) */
  fallback?: React.ReactNode;
  /** Loading state to render while permissions hydrate (default: null) */
  loading?: React.ReactNode;
  /** Optional className for wrapper div */
  className?: string;
}

// ============================================================================
// User Permission Context Types
// ============================================================================

/** User permission data structure */
export interface UserPermissions {
  /** User's ID */
  userId: string;
  /** Flat array of permission strings (server-computed) */
  permissions: string[];
  /** User's roles (for display/debugging) */
  roles?: string[];
  /** When permissions were last fetched */
  fetchedAt?: Date;
}

/** Permission context value */
export interface PermissionContextValue {
  /** User's permissions */
  permissions: string[];
  /** Whether permissions are loading */
  isLoading: boolean;
  /** Check if user has a permission (or any in array) */
  hasPermission: (
    permission: PermissionInput,
    mode?: PermissionMode,
  ) => boolean;
  /** Check if user has all permissions in array */
  hasAllPermissions: (permissions: Permission[]) => boolean;
  /** Check if user has any permission in array */
  hasAnyPermission: (permissions: Permission[]) => boolean;
  /** Revalidate/fetch permissions */
  revalidate?: () => Promise<void>;
}

// ============================================================================
// Utility Types
// ============================================================================

/** Extract service from permission string */
export type ExtractService<T extends string> =
  T extends `${infer Service}:${string}:${string}` ? Service : never;

/** Extract component from permission string */
export type ExtractComponent<T extends string> =
  T extends `${string}:${infer Component}:${string}` ? Component : never;

/** Extract action from permission string */
export type ExtractAction<T extends string> =
  T extends `${string}:${string}:${infer Action}` ? Action : never;

/**
 * Helper type to create permission strings for a specific service
 * Usage: ServicePermission<"iam">
 */
export type ServicePermission<T extends Service> =
  `${T}:${string}:${ExtendedAction}`;

/**
 * Helper type to create permission strings for a specific component
 * Usage: ComponentPermission<"users">
 */
export type ComponentPermission<T extends string> =
  `${string}:${T}:${ExtendedAction}`;
