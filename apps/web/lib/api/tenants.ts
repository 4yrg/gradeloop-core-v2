import { axiosInstance } from "./axios";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain: string;
  keycloak_id?: string;
  is_active: boolean;
  settings?: string;
  created_at: string;
  updated_at?: string;
}

export interface TenantStats {
  tenant_id: string;
  users: number;
  courses: number;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

function normalize<T>(raw: unknown): PaginatedResponse<T> {
  if (Array.isArray(raw)) {
    return { data: raw as T[], total: raw.length, page: 1, limit: raw.length };
  }
  const r = raw as Record<string, unknown>;
  return {
    data: (r.data as T[]) || [],
    total: (r.total as number) || 0,
    page: (r.page as number) || 1,
    limit: (r.limit as number) || 20,
  };
}

export const tenantsApi = {
  list: async (page = 1, limit = 20, search = ""): Promise<PaginatedResponse<Tenant>> => {
    const { data } = await axiosInstance.get("/tenants", {
      params: { page, limit, search },
    });
    return normalize<Tenant>(data);
  },

  get: async (id: string): Promise<Tenant> => {
    const { data } = await axiosInstance.get<Tenant>(`/tenants/${id}`);
    return data;
  },

  create: async (payload: { name: string; slug: string; domain: string; settings?: string }): Promise<Tenant> => {
    const { data } = await axiosInstance.post<Tenant>("/tenants", payload);
    return data;
  },

  update: async (id: string, payload: { name?: string; domain?: string; is_active?: boolean; settings?: string }): Promise<Tenant> => {
    const { data } = await axiosInstance.put<Tenant>(`/tenants/${id}`, payload);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/tenants/${id}`);
  },

  stats: async (id: string): Promise<TenantStats> => {
    const { data } = await axiosInstance.get<TenantStats>(`/tenants/${id}/stats`);
    return data;
  },

  resolveByDomain: async (domain: string): Promise<Tenant> => {
    const { data } = await axiosInstance.get<Tenant>("/tenants/resolve", {
      params: { domain },
    });
    return data;
  },
};