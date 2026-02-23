/**
 * useAcademicsAccess
 *
 * Derives academics RBAC from the JWT role_name stored in authStore.
 * The academic-service backend uses role-based checks (not permission strings):
 *   - super_admin  → full access (including faculties management)
 *   - admin        → departments, degrees, courses read + write
 *
 * Permission gating strategy: role + action level (Option B).
 * The role_name comes from the decoded JWT, so no extra API round-trip needed.
 */
import { useAuthStore } from '@/lib/stores/authStore';

export interface AcademicsAccess {
  /** True if the user can view academics admin pages (admin or super_admin). */
  canAccess: boolean;
  /** True if the user can create/update/deactivate entities. */
  canWrite: boolean;
  /** True if the user is super_admin (required for faculties management). */
  isSuperAdmin: boolean;
}

function normaliseRole(raw: string): string {
  return raw.toLowerCase().trim().replace(/\s+/g, '_');
}

export function useAcademicsAccess(): AcademicsAccess {
  const roleName = useAuthStore((s) => s.user?.role_name ?? '');
  const n = normaliseRole(roleName);

  const isSuperAdmin = n === 'super_admin';
  const isAdmin = isSuperAdmin || n === 'admin';

  return {
    canAccess: isAdmin,
    canWrite: isAdmin,
    isSuperAdmin,
  };
}
