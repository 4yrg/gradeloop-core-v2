import { axiosInstance } from "@/lib/api/axios";
import type {
  UnreadCountResponse,
  ListNotificationsResponse,
} from "@/types/notification.types";

export const notificationsApi = {
  list: async (page = 1, perPage = 20, read?: boolean) => {
    const params: Record<string, unknown> = { page, per_page: perPage };
    if (read !== undefined) params.read = String(read);
    const { data } = await axiosInstance.get<ListNotificationsResponse>(
      "/notifications",
      { params },
    );
    return data;
  },

  getUnreadCount: async () => {
    const { data } = await axiosInstance.get<UnreadCountResponse>(
      "/notifications/unread-count",
    );
    return data;
  },

  markAsRead: async (id: string) => {
    await axiosInstance.patch(`/notifications/${id}/read`);
  },

  markAllAsRead: async () => {
    await axiosInstance.patch("/notifications/read-all");
  },

  delete: async (id: string) => {
    await axiosInstance.delete(`/notifications/${id}`);
  },
};