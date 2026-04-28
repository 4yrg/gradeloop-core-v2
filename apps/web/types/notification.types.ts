export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
  read_at: string | null;
}

export interface UnreadCountResponse {
  count: number;
}

export interface ListNotificationsResponse {
  notifications: Notification[];
  total: number;
  page: number;
  per_page: number;
}

export type SSEEvent =
  | { event: "notification.created"; data: Notification }
  | { event: "notification.unread_count"; data: { count: number } }
  | { event: "connected"; data: { status: string } }
  | { event: "heartbeat"; data: { ts: number } };