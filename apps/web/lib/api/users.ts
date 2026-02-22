import { axiosInstance, handleApiError } from './axios';
import type { UserListItem } from '@/types/auth.types';
import type {
  PaginatedResponse,
  ListUsersParams,
  CreateUserRequest,
  UpdateUserRequest,
  AssignRoleRequest,
} from '@/types/admin.types';

export type PaginatedUsers = PaginatedResponse<UserListItem>;

/**
 * Normalises the backend response which may return:
 *   - a plain array
 *   - { data: [], total, page, limit }
 *   - { users: [], meta: { total, page, limit } }
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizePaginated(raw: any, params: ListUsersParams): PaginatedUsers {
  if (Array.isArray(raw)) {
    return {
      data: raw as UserListItem[],
      total: raw.length,
      page: params.page ?? 1,
      limit: params.limit ?? raw.length,
    };
  }
  if (Array.isArray(raw?.data)) return raw as PaginatedUsers;
  if (Array.isArray(raw?.users)) {
    return {
      data: raw.users as UserListItem[],
      total: raw.meta?.total ?? raw.users.length,
      page: raw.meta?.page ?? 1,
      limit: raw.meta?.limit ?? raw.users.length,
    };
  }
  return raw as PaginatedUsers;
}

export const usersApi = {
  /** GET /users?page=1&limit=10&search=... */
  list: async (params: ListUsersParams = {}): Promise<PaginatedUsers> => {
    const cleanParams: Record<string, unknown> = {};
    if (params.page !== undefined) cleanParams.page = params.page;
    if (params.limit !== undefined) cleanParams.limit = params.limit;
    if (params.search) cleanParams.search = params.search;
    if (params.role_id) cleanParams.role_id = params.role_id;
    if (params.is_active !== undefined) cleanParams.is_active = params.is_active;

    const { data } = await axiosInstance.get('/users', { params: cleanParams });
    return normalizePaginated(data, params);
  },

  /** GET /users/:id */
  get: async (id: string): Promise<UserListItem> => {
    const { data } = await axiosInstance.get<UserListItem>(`/users/${id}`);
    return data;
  },

  /** POST /users */
  create: async (payload: CreateUserRequest): Promise<UserListItem> => {
    const { data } = await axiosInstance.post<UserListItem>('/users', payload);
    return data;
  },

  /** PUT /users/:id */
  update: async (id: string, payload: UpdateUserRequest): Promise<UserListItem> => {
    const { data } = await axiosInstance.put<UserListItem>(`/users/${id}`, payload);
    return data;
  },

  /** DELETE /users/:id */
  delete: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/users/${id}`);
  },

  /** POST /users/:id/roles */
  assignRole: async (id: string, payload: AssignRoleRequest): Promise<void> => {
    await axiosInstance.post(`/users/${id}/roles`, payload);
  },

  /** POST /admin/users/:id/revoke-sessions */
  revokeSessions: async (id: string): Promise<void> => {
    await axiosInstance.post(`/admin/users/${id}/revoke-sessions`);
  },
};

export { handleApiError };
