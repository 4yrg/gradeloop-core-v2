package dto

import "time"

type CreateNotificationRequest struct {
	UserIDs []string         `json:"user_ids" validate:"required,min=1"`
	Type    string           `json:"type" validate:"required"`
	Title   string           `json:"title" validate:"required"`
	Message string           `json:"message" validate:"required"`
	Data    map[string]any   `json:"data,omitempty"`
}

type NotificationResponse struct {
	ID        string         `json:"id"`
	UserID    string         `json:"user_id"`
	Type      string         `json:"type"`
	Title     string         `json:"title"`
	Message   string         `json:"message"`
	Data      map[string]any `json:"data,omitempty"`
	Read      bool           `json:"read"`
	CreatedAt time.Time      `json:"created_at"`
	ReadAt    *time.Time     `json:"read_at,omitempty"`
}

type UnreadCountResponse struct {
	Count int64 `json:"count"`
}

type ListNotificationsResponse struct {
	Notifications []NotificationResponse `json:"notifications"`
	Total         int64                   `json:"total"`
	Page          int                     `json:"page"`
	PerPage       int                     `json:"per_page"`
}

type MarkReadRequest struct {
	Read bool `json:"read"`
}

type EventNotification struct {
	Event string               `json:"event"`
	Data  NotificationResponse `json:"data"`
}

type EventUnreadCount struct {
	Event string `json:"event"`
	Count int64  `json:"count"`
}