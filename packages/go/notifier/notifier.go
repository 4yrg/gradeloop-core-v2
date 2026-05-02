package notifier

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"time"
)

const (
	NotificationExchange   = "notifications"
	NotificationRoutingKey = "notification.created"
)

type Notification struct {
	ID        string         `json:"id"`
	UserIDs   []string       `json:"user_ids"`
	Type      string         `json:"type"`
	Title     string         `json:"title"`
	Message   string         `json:"message"`
	Data      map[string]any `json:"data,omitempty"`
	Timestamp time.Time      `json:"timestamp"`
}

func NewNotification(userIDs []string, notifType, title, message string, data map[string]any) Notification {
	return Notification{
		ID:        time.Now().UTC().Format("20060102150405") + "-" + randomSuffix(8),
		UserIDs:   userIDs,
		Type:      notifType,
		Title:     title,
		Message:   message,
		Data:      data,
		Timestamp: time.Now().UTC(),
	}
}

func (n Notification) Marshal() ([]byte, error) {
	return json.Marshal(n)
}

func randomSuffix(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func (n Notification) MessageID() string {
	return n.ID
}

func UnmarshalNotification(data []byte) (Notification, error) {
	var n Notification
	if err := json.Unmarshal(data, &n); err != nil {
		return Notification{}, err
	}
	return n, nil
}
