import { axiosInstance } from "./axios";

export interface MFAStatus {
  enabled: boolean;
  status: "disabled" | "pending" | "enabled";
}

export interface MFAGenerateResponse {
  secret: string;
  message: string;
}

export const mfaApi = {
  generateSecret: async (): Promise<MFAGenerateResponse> => {
    const { data } = await axiosInstance.post<MFAGenerateResponse>("/auth/mfa/generate");
    return data;
  },

  enable: async (payload: { secret: string; code: string }): Promise<{ message: string }> => {
    const { data } = await axiosInstance.post("/auth/mfa/enable", payload);
    return data;
  },

  verify: async (code: string): Promise<{ message: string }> => {
    const { data } = await axiosInstance.post("/auth/mfa/verify", { code });
    return data;
  },

  disable: async (): Promise<{ message: string }> => {
    const { data } = await axiosInstance.post("/auth/mfa/disable");
    return data;
  },

  getStatus: async (): Promise<MFAStatus> => {
    const { data } = await axiosInstance.get<MFAStatus>("/auth/mfa/status");
    return data;
  },
};