/**
 * Standalone user type helpers.
 *
 * Work directly with the user_type data from JWT claims.
 * Safe to use outside React (middleware, server utilities, etc.).
 */

// ---------------------------------------------------------------------------
// User type → dashboard route mapping
// ---------------------------------------------------------------------------
export const USER_TYPE_DASHBOARD_MAP: Record<string, string> = {
  admin: '/admin',
  instructor: '/instructor',
  student: '/student',
};

// ---------------------------------------------------------------------------
// Helpers

/**
 * Returns the default dashboard path for the user's type.
 * Falls back to '/admin' when no mapping exists.
 */
export function getUserTypeDashboard(userType: string): string {
  return USER_TYPE_DASHBOARD_MAP[userType.toLowerCase()] ?? '/admin';
}

/** Returns true when `userType` matches the user's assigned type. */
export function hasUserType(userUserType: string, checkType: string): boolean {
  return userUserType.toLowerCase() === checkType.toLowerCase();
}

/** Returns true when user has admin access. */
export function hasAdminAccess(userType: string): boolean {
  return userType === 'admin';
}

/** Returns true when user has instructor access (instructor or admin). */
export function hasInstructorAccess(userType: string): boolean {
  return userType === 'instructor' || hasAdminAccess(userType);
}