import { create } from "zustand";
import { axiosInstance } from "@/lib/api/axios";
import { useAuthStore } from "@/lib/stores/authStore";
import type {
  Notification,
  UnreadCountResponse,
  ListNotificationsResponse,
} from "@/types/notification.types";

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  connected: boolean;
  isLoading: boolean;

  fetchNotifications: (page?: number) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;

  addNotification: (notification: Notification) => void;
  setUnreadCount: (count: number) => void;
  setConnected: (connected: boolean) => void;
  reset: () => void;
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  notifications: [],
  unreadCount: 0,
  connected: false,
  isLoading: false,

  fetchNotifications: async (page = 1) => {
    // Don't try to fetch if not authenticated
    const isAuthenticated = useAuthStore.getState().isAuthenticated;
    if (!isAuthenticated) {
      set({ isLoading: false });
      return;
    }
    
    set({ isLoading: true });
    try {
      const { data } = await axiosInstance.get<ListNotificationsResponse>(
        "/notifications",
        { params: { page, per_page: 20 } },
      );
      set({ notifications: data.notifications, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchUnreadCount: async () => {
    // Don't try to fetch if not authenticated
    const isAuthenticated = useAuthStore.getState().isAuthenticated;
    if (!isAuthenticated) return;
    
    try {
      const { data } = await axiosInstance.get<UnreadCountResponse>(
        "/notifications/unread-count",
      );
      set({ unreadCount: data.count });
    } catch {
      // silently ignore but don't retry infinitely
    }
  },

  markAsRead: async (id: string) => {
    try {
      await axiosInstance.patch(`/notifications/${id}/read`);
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n,
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch {
      // silently ignore
    }
  },

  markAllAsRead: async () => {
    try {
      await axiosInstance.patch("/notifications/read-all");
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      }));
    } catch {
      // silently ignore
    }
  },

  deleteNotification: async (id: string) => {
    try {
      await axiosInstance.delete(`/notifications/${id}`);
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
        unreadCount: state.notifications.find((n) => n.id === id && !n.read)
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount,
      }));
    } catch {
      // silently ignore
    }
  },

  addNotification: (notification: Notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }));
  },

  setUnreadCount: (count: number) => {
    set({ unreadCount: count });
  },

  setConnected: (connected: boolean) => {
    set({ connected });
  },

  reset: () => {
    set({
      notifications: [],
      unreadCount: 0,
      connected: false,
      isLoading: false,
    });
  },
}));
