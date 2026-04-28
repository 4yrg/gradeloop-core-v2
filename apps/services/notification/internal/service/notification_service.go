package service

import (
	"context"
	"encoding/json"

	notifier "github.com/4yrg/gradeloop-core-v2/packages/go/notifier"
	"github.com/4yrg/gradeloop-core-v2/apps/services/notification/internal/domain"
	redispubsub "github.com/4yrg/gradeloop-core-v2/apps/services/notification/internal/redis"
	"github.com/4yrg/gradeloop-core-v2/apps/services/notification/internal/repository"
	"github.com/4yrg/gradeloop-core-v2/apps/services/notification/internal/sse"
	"github.com/google/uuid"
	"gorm.io/datatypes"
	"go.uber.org/zap"
)

type NotificationService struct {
	repo   *repository.NotificationRepository
	hub    *sse.Hub
	ps     *redispubsub.PubSub
	logger *zap.Logger
}

func NewNotificationService(
	repo *repository.NotificationRepository,
	hub *sse.Hub,
	ps *redispubsub.PubSub,
	logger *zap.Logger,
) *NotificationService {
	return &NotificationService{
		repo:   repo,
		hub:    hub,
		ps:     ps,
		logger: logger,
	}
}

func (s *NotificationService) ProcessIncoming(ctx context.Context, n notifier.Notification) error {
	s.logger.Info("processing incoming notification",
		zap.String("id", n.ID),
		zap.String("type", n.Type),
		zap.Int("recipients", len(n.UserIDs)),
	)

	var dataJSON datatypes.JSON
	if n.Data != nil {
		data, err := json.Marshal(n.Data)
		if err != nil {
			s.logger.Error("marshaling notification data", zap.Error(err))
		} else {
			dataJSON = data
		}
	}

	notifications := make([]domain.Notification, 0, len(n.UserIDs))
	for _, uid := range n.UserIDs {
		userID, err := uuid.Parse(uid)
		if err != nil {
			s.logger.Warn("skipping invalid user_id", zap.String("user_id", uid), zap.Error(err))
			continue
		}

		notif := domain.Notification{
			UserID:  userID,
			Type:    n.Type,
			Title:   n.Title,
			Message: n.Message,
			Data:    dataJSON,
		}
		notifications = append(notifications, notif)
	}

	if len(notifications) == 0 {
		s.logger.Warn("no valid user_ids in notification, skipping", zap.String("id", n.ID))
		return nil
	}

	if err := s.repo.CreateBatch(ctx, notifications); err != nil {
		return err
	}

	for _, notif := range notifications {
		resp := toResponse(notif)
		payload, err := json.Marshal(resp)
		if err != nil {
			s.logger.Error("marshaling notification response", zap.Error(err))
			continue
		}

		sseMsg := sse.FormatSSE("notification.created", notif.ID.String(), payload)
		s.hub.SendToUser(notif.UserID.String(), sseMsg)

		if s.ps != nil {
			if err := s.ps.Publish(ctx, notif.UserID.String(), resp); err != nil {
				s.logger.Error("redis publish error",
					zap.String("user_id", notif.UserID.String()),
					zap.Error(err),
				)
			}
		}
	}

	s.logger.Info("notification processed",
		zap.String("id", n.ID),
		zap.Int("recipients", len(notifications)),
	)
	return nil
}

func (s *NotificationService) ListByUserID(ctx context.Context, userID uuid.UUID, read *bool, page, perPage int) ([]domain.Notification, int64, error) {
	return s.repo.ListByUserID(ctx, userID, read, page, perPage)
}

func (s *NotificationService) CountUnreadByUserID(ctx context.Context, userID uuid.UUID) (int64, error) {
	return s.repo.CountUnreadByUserID(ctx, userID)
}

func (s *NotificationService) MarkAsRead(ctx context.Context, id, userID uuid.UUID) error {
	return s.repo.MarkAsRead(ctx, id, userID)
}

func (s *NotificationService) MarkAllAsRead(ctx context.Context, userID uuid.UUID) error {
	return s.repo.MarkAllAsRead(ctx, userID)
}

func (s *NotificationService) Delete(ctx context.Context, id, userID uuid.UUID) error {
	return s.repo.Delete(ctx, id, userID)
}

func toResponse(n domain.Notification) map[string]any {
	var data map[string]any
	if len(n.Data) > 0 {
		_ = json.Unmarshal(n.Data, &data)
	}
	return map[string]any{
		"id":         n.ID.String(),
		"user_id":    n.UserID.String(),
		"type":       n.Type,
		"title":      n.Title,
		"message":    n.Message,
		"data":       data,
		"read":       n.Read,
		"created_at": n.CreatedAt,
		"read_at":    n.ReadAt,
	}
}