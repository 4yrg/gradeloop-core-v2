/**
 * Admin-specific request/response types.
 *
 * Re-exports shared types from auth.types so consumers only need one import.
 */

export type { UserListItem, Role, Permission } from '@/types/auth.types';

// ── Pagination ───────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages?: number;
}

// ── Users ────────────────────────────────────────────────────────────────────

export interface ListUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  role_id?: string;
  is_active?: boolean;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  role_id: string;
  password?: string;
}

/**
 * PUT /users/:id
 * The backend accepts full_name and is_active.
 * username/email are not updateable via this endpoint.
 */
export interface UpdateUserRequest {
  full_name?: string;
  is_active?: boolean;
}

export interface AssignRoleRequest {
  role_id: string;
}

// ── Form validation ──────────────────────────────────────────────────────────

export interface FormErrors {
  [field: string]: string | undefined;
}
