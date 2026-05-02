"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/lib/stores/authStore";
import { useNotificationStore } from "@/lib/stores/notificationStore";

const NOTIFICATION_SSE_URL =
  process.env.NEXT_PUBLIC_NOTIFICATION_SSE_URL ||
  `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}/notifications/stream`;

export function useNotifications() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setConnected = useNotificationStore((s) => s.setConnected);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);
  const fetchUnreadCount = useNotificationStore((s) => s.fetchUnreadCount);
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);
  const reset = useNotificationStore((s) => s.reset);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Store connect function for reconnect logic
  const connectRef = useRef<() => void>(null);

  const connect = useCallback(() => {
    if (!accessToken || !isAuthenticated) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = NOTIFICATION_SSE_URL.replace(/\/stream$/, "/stream");

    const es = new EventSource(`${url}?token=${accessToken}`);
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
    };

    es.addEventListener("notification.created", (event) => {
      try {
        const notification = JSON.parse(event.data);
        addNotification(notification);
      } catch {
        // ignore parse errors
      }
    });

    es.addEventListener("notification.unread_count", (event) => {
      try {
        const data = JSON.parse(event.data);
        setUnreadCount(data.count);
      } catch {
        // ignore parse errors
      }
    });

    es.addEventListener("heartbeat", () => {
      // keepalive, nothing to do
    });

    es.onerror = () => {
      setConnected(false);
      es.close();
      eventSourceRef.current = null;

      // Reconnect after 5 seconds
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        if (isAuthenticated && accessToken) {
          if (connectRef.current) {
            connectRef.current();
          }
        }
      }, 5000);
    };
  }, [accessToken, isAuthenticated, setConnected, addNotification, setUnreadCount]);

  // Store connect function ref after definition for reconnect logic
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      fetchUnreadCount();
      fetchNotifications();
      connect();
    } else {
      reset();
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [isAuthenticated, accessToken, connect, fetchUnreadCount, fetchNotifications, reset]);

  const connected = useNotificationStore((s) => s.connected);
  return { connected };
}