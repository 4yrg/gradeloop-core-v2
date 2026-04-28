import { axiosInstance } from "./axios";
import type { Role, Permission } from "@/types/auth.types";

function normalizeArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    if (Array.isArray(r.data)) return r.data as T[];
  }
  return [];
}

export const rolesApi = {
  list: async (tenantId?: string): Promise<Role[]> => {
    const params = tenantId ? { tenant_id: tenantId } : {};
    const { data } = await axiosInstance.get("/roles", { params });
    return normalizeArray<Role>(data);
  },

  get: async (id: string): Promise<Role> => {
    const { data } = await axiosInstance.get<Role>(`/roles/${id}`);
    return data;
  },

  create: async (payload: { name: string; description?: string }): Promise<Role> => {
    const { data } = await axiosInstance.post<Role>("/roles", payload);
    return data;
  },

  update: async (id: string, payload: { name?: string; description?: string }): Promise<Role> => {
    const { data } = await axiosInstance.put<Role>(`/roles/${id}`, payload);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/roles/${id}`);
  },

  assignToUser: async (userId: string, roleId: string, tenantId?: string): Promise<void> => {
    await axiosInstance.post(`/users/${userId}/roles`, { role_id: roleId, tenant_id: tenantId });
  },
};

export const permissionsApi = {
  list: async (category?: string): Promise<Permission[]> => {
    const params = category ? { category } : {};
    const { data } = await axiosInstance.get("/permissions", { params });
    return normalizeArray<Permission>(data);
  },
};