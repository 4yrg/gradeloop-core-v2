import { axiosInstance } from "./axios";
import type {
  Tenant,
  TenantStats,
  CreateTenantRequest,
  UpdateTenantRequest,
  TenantListResponse,
} from "@/types/tenant.types";

export const tenantsApi = {
  list: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<TenantListResponse> => {
    const { data } = await axiosInstance.get<TenantListResponse>("/tenants", {
      params,
    });
    return data;
  },

  get: async (id: string): Promise<Tenant> => {
    const { data } = await axiosInstance.get<Tenant>(`/tenants/${id}`);
    return data;
  },

  create: async (payload: CreateTenantRequest): Promise<Tenant> => {
    const { data } = await axiosInstance.post<Tenant>("/tenants", payload);
    return data;
  },

  update: async (id: string, payload: UpdateTenantRequest): Promise<Tenant> => {
    const { data } = await axiosInstance.put<Tenant>(`/tenants/${id}`, payload);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await axiosInstance.delete(`/tenants/${id}`);
  },

  getStats: async (id: string): Promise<TenantStats> => {
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