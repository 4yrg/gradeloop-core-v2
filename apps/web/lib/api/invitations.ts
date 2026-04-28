import { axiosInstance } from "./axios";

export interface Invitation {
  id: string;
  tenant_id: string;
  email: string;
  role: string;
  full_name: string;
  department?: string;
  batch?: string;
  invitation_code: string;
  status: "pending" | "used" | "expired" | "cancelled";
  expires_at: string;
  accepted_at?: string;
  invited_by: string;
  created_at: string;
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

export const invitationsApi = {
  list: async (page = 1, limit = 20, status = ""): Promise<PaginatedResponse<Invitation>> => {
    const { data } = await axiosInstance.get("/invitations", {
      params: { page, limit, status },
    });
    return normalize<Invitation>(data);
  },

  get: async (id: string): Promise<Invitation> => {
    const { data } = await axiosInstance.get<Invitation>(`/invitations/${id}`);
    return data;
  },

  create: async (payload: {
    email: string;
    role: string;
    full_name: string;
    department?: string;
    batch?: string;
  }): Promise<Invitation> => {
    const { data } = await axiosInstance.post<Invitation>("/invitations", payload);
    return data;
  },

  resend: async (id: string): Promise<Invitation> => {
    const { data } = await axiosInstance.post<Invitation>(`/invitations/${id}/resend`);
    return data;
  },

  cancel: async (id: string): Promise<void> => {
    await axiosInstance.post(`/invitations/${id}/cancel`);
  },

  accept: async (code: string): Promise<Invitation> => {
    const { data } = await axiosInstance.post<Invitation>("/invitations/accept", { code });
    return data;
  },
};