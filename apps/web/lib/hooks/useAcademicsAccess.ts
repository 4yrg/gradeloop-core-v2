/**
 * useAcademicsAccess
 *
 * Derives academics access from the JWT user_type stored in authStore.
 * The academic-service backend uses user type checks:
 *   - admin        → full access (departments, degrees, courses, faculties read + write)
 *
 * Permission gating strategy: user type + action level.
 * The user_type comes from the decoded JWT, so no extra API round-trip needed.
 */
import { useAuthStore } from '@/lib/stores/authStore';

export interface AcademicsAccess {
  /** True if the user can view academics admin pages (admin). */
  canAccess: boolean;
  /** True if the user can create/update/deactivate entities. */
  canWrite: boolean;
  /** True if user has admin privileges (all access). */
  isSuperAdmin: boolean;
}

export function useAcademicsAccess(): AcademicsAccess {
  const userType = useAuthStore((s) => s.user?.user_type ?? '');

  const isAdmin = userType === 'admin';

  return {
    canAccess: isAdmin,
    canWrite: isAdmin,
    isSuperAdmin: isAdmin,
  };
}