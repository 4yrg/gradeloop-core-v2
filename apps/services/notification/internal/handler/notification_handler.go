package handler

import (
	"encoding/json"
	"strconv"

	"github.com/4yrg/gradeloop-core-v2/apps/services/notification/internal/domain"
	"github.com/4yrg/gradeloop-core-v2/apps/services/notification/internal/dto"
	"github.com/4yrg/gradeloop-core-v2/apps/services/notification/internal/service"
	"github.com/4yrg/gradeloop-core-v2/apps/services/notification/internal/utils"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type NotificationHandler struct {
	service *service.NotificationService
	logger  *zap.Logger
}

func NewNotificationHandler(service *service.NotificationService, logger *zap.Logger) *NotificationHandler {
	return &NotificationHandler{service: service, logger: logger}
}

func (h *NotificationHandler) List(c fiber.Ctx) error {
	userID, err := requireUserID(c)
	if err != nil {
		return err
	}

	page, _ := strconv.Atoi(c.Query("page", "1"))
	perPage, _ := strconv.Atoi(c.Query("per_page", "20"))
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	var readFilter *bool
	if v := c.Query("read"); v != "" {
		b := v == "true"
		readFilter = &b
	}

	notifications, total, err := h.service.ListByUserID(c, userID, readFilter, page, perPage)
	if err != nil {
		h.logger.Error("listing notifications", zap.Error(err))
		return utils.ErrInternal("failed to list notifications", err)
	}

	items := make([]dto.NotificationResponse, len(notifications))
	for i, n := range notifications {
		items[i] = toNotificationResponse(n)
	}

	return c.JSON(dto.ListNotificationsResponse{
		Notifications: items,
		Total:        total,
		Page:         page,
		PerPage:       perPage,
	})
}

func (h *NotificationHandler) GetUnreadCount(c fiber.Ctx) error {
	userID, err := requireUserID(c)
	if err != nil {
		return err
	}

	count, err := h.service.CountUnreadByUserID(c, userID)
	if err != nil {
		h.logger.Error("counting unread notifications", zap.Error(err))
		return utils.ErrInternal("failed to count unread notifications", err)
	}

	return c.JSON(dto.UnreadCountResponse{Count: count})
}

func (h *NotificationHandler) MarkAsRead(c fiber.Ctx) error {
	userID, err := requireUserID(c)
	if err != nil {
		return err
	}

	notificationID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.ErrBadRequest("invalid notification id")
	}

	if err := h.service.MarkAsRead(c, notificationID, userID); err != nil {
		h.logger.Error("marking notification as read", zap.Error(err))
		return utils.ErrInternal("failed to mark notification as read", err)
	}

	return c.SendStatus(fiber.StatusNoContent)
}

func (h *NotificationHandler) MarkAllAsRead(c fiber.Ctx) error {
	userID, err := requireUserID(c)
	if err != nil {
		return err
	}

	if err := h.service.MarkAllAsRead(c, userID); err != nil {
		h.logger.Error("marking all notifications as read", zap.Error(err))
		return utils.ErrInternal("failed to mark all notifications as read", err)
	}

	return c.SendStatus(fiber.StatusNoContent)
}

func (h *NotificationHandler) Delete(c fiber.Ctx) error {
	userID, err := requireUserID(c)
	if err != nil {
		return err
	}

	notificationID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return utils.ErrBadRequest("invalid notification id")
	}

	if err := h.service.Delete(c, notificationID, userID); err != nil {
		h.logger.Error("deleting notification", zap.Error(err))
		return utils.ErrInternal("failed to delete notification", err)
	}

	return c.SendStatus(fiber.StatusNoContent)
}

func requireUserID(c fiber.Ctx) (uuid.UUID, error) {
	userIDStr, ok := c.Locals("user_id").(string)
	if !ok || userIDStr == "" {
		return uuid.Nil, utils.ErrUnauthorized("user not authenticated")
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return uuid.Nil, utils.ErrBadRequest("invalid user id")
	}
	return userID, nil
}

func toNotificationResponse(n domain.Notification) dto.NotificationResponse {
	var data map[string]any
	if len(n.Data) > 0 {
		_ = json.Unmarshal(n.Data, &data)
	}

	return dto.NotificationResponse{
		ID:        n.ID.String(),
		UserID:    n.UserID.String(),
		Type:      n.Type,
		Title:     n.Title,
		Message:   n.Message,
		Data:      data,
		Read:      n.Read,
		CreatedAt: n.CreatedAt,
		ReadAt:    n.ReadAt,
	}
}