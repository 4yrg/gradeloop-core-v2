/**
 * Global Users API — Super Admin endpoint for managing users across all tenants.
 * Requires super_admin user_type.
 */

import { axiosInstance, handleApiError } from "./axios";

export interface GlobalUserListItem {
  id: string;
  email: string;
  full_name: string;
  user_type: string;
  is_active: boolean;
  email_verified: boolean;
  tenant_id: string;
  tenant_name: string;
  last_login_at: string | null;
  created_at: string;
}

export interface GlobalUserListParams {
  page?: number;
  limit?: number;
  search?: string;
  tenant_id?: string;
  user_type?: string;
  is_active?: boolean;
}

export interface PaginatedGlobalUsers {
  data: GlobalUserListItem[];
  total: number;
  page: number;
  limit: number;
  total_pages?: number;
}

function normalizePaginated(raw: unknown, params: GlobalUserListParams): PaginatedGlobalUsers {
  const data = raw as {
    data?: GlobalUserListItem[];
    total?: number;
    page?: number;
    limit?: number;
  };

  if (Array.isArray(raw)) {
    return {
      data: raw as GlobalUserListItem[],
      total: raw.length,
      page: params.page ?? 1,
      limit: params.limit ?? raw.length,
    };
  }

  if (Array.isArray(data?.data)) {
    return data as PaginatedGlobalUsers;
  }

  return data as PaginatedGlobalUsers;
}

export const globalUsersApi = {
  /** GET /admin/users — list all users across tenants (super admin only) */
  list: async (params: GlobalUserListParams = {}): Promise<PaginatedGlobalUsers> => {
    const cleanParams: Record<string, unknown> = {};
    if (params.page !== undefined) cleanParams.page = params.page;
    if (params.limit !== undefined) cleanParams.limit = params.limit;
    if (params.search) cleanParams.search = params.search;
    if (params.tenant_id) cleanParams.tenant_id = params.tenant_id;
    if (params.user_type) cleanParams.user_type = params.user_type;
    if (params.is_active !== undefined) cleanParams.is_active = params.is_active;

    const { data } = await axiosInstance.get("/admin/users", {
      params: cleanParams,
    });
    return normalizePaginated(data, params);
  },

  /** GET /admin/users/:id — get single user (super admin only) */
  get: async (id: string): Promise<GlobalUserListItem> => {
    const { data } = await axiosInstance.get<GlobalUserListItem>(
      `/admin/users/${id}`,
    );
    return data;
  },

  /** PUT /admin/users/:id — update user across tenants (super admin only) */
  update: async (
    id: string,
    payload: {
      user_type?: string;
      is_active?: boolean;
    },
  ): Promise<{ id: string; message: string }> => {
    const { data } = await axiosInstance.put(`/admin/users/${id}`, payload);
    return data;
  },

  /** POST /admin/users/:id/suspend — suspend user account */
  suspend: async (id: string): Promise<{ id: string; message: string }> => {
    const { data } = await axiosInstance.post(`/admin/users/${id}/suspend`);
    return data;
  },

  /** POST /admin/users/:id/activate — activate user account */
  activate: async (id: string): Promise<{ id: string; message: string }> => {
    const { data } = await axiosInstance.post(`/admin/users/${id}/activate`);
    return data;
  },

  /** GET /admin/tenants — list all tenants (super admin only) */
  listTenants: async (): Promise<
    Array<{
      id: string;
      name: string;
      plan: string;
      status: string;
      user_count: number;
    }>
  > => {
    const { data } = await axiosInstance.get("/admin/tenants");
    return data;
  },

  /** GET /admin/subscriptions — list all subscriptions */
  listSubscriptions: async (): Promise<
    Array<{
      id: string;
      tenant_id: string;
      tenant_name: string;
      plan: string;
      status: string;
      max_users: number;
      max_courses: number;
      storage_gb: number;
      monthly_amount: number;
    }>
  > => {
    const { data } = await axiosInstance.get("/admin/subscriptions");
    return data;
  },

  /** PUT /admin/subscriptions/:id/quota — adjust subscription quota */
  adjustQuota: async (
    id: string,
    payload: {
      max_users?: number;
      max_courses?: number;
      storage_gb?: number;
    },
  ): Promise<{ id: string; message: string }> => {
    const { data } = await axiosInstance.put(`/admin/subscriptions/${id}/quota`, payload);
    return data;
  },
};

export { handleApiError };