package handler

import (
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/domain"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/service"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"strconv"
)

type AuditHandler struct {
	auditService service.AuditService
}

func NewAuditHandler(auditService service.AuditService) *AuditHandler {
	return &AuditHandler{auditService: auditService}
}

func (h *AuditHandler) RegisterRoutes(router fiber.Router) {
	audit := router.Group("/audit-logs")
	audit.Get("/", h.GetAuditLogs)
}

func (h *AuditHandler) GetAuditLogs(c fiber.Ctx) error {
	userType, _ := c.Locals("user_type").(string)
	if userType != "super_admin" {
		return fiber.NewError(fiber.StatusForbidden, "Super admin access required")
	}

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	action := c.Query("action", "")
	userIDStr := c.Query("user_id", "")

	var userID *uuid.UUID
	if userIDStr != "" {
		id, err := uuid.Parse(userIDStr)
		if err == nil {
			userID = &id
		}
	}

	var logs []*domain.ActivityLog
	var total int64
	var err error

	if userID != nil {
		logs, total, err = h.auditService.GetByUser(c.RequestCtx(), *userID, page, limit)
	} else {
		logs, total, err = h.auditService.GetGlobal(c.RequestCtx(), page, limit, action, "")
	}

	if err != nil {
		return handleAuditError(err)
	}

	return c.JSON(fiber.Map{
		"data":  logs,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func handleAuditError(err error) error {
	switch err {
	case service.ErrAuditNotFound:
		return fiber.NewError(fiber.StatusNotFound, "Audit log not found")
	default:
		return err
	}
}
