package handler

import (
	"strconv"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/service"
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

type InvitationHandler struct {
	invitationService service.InvitationService
}

func NewInvitationHandler(invitationService service.InvitationService) *InvitationHandler {
	return &InvitationHandler{invitationService: invitationService}
}

func (h *InvitationHandler) RegisterRoutes(router fiber.Router) {
	invitations := router.Group("/invitations")
	invitations.Get("/", h.ListInvitations)
	invitations.Post("/", h.CreateInvitation)
	invitations.Get("/:id", h.GetInvitation)
	invitations.Post("/:id/resend", h.ResendInvitation)
	invitations.Post("/:id/cancel", h.CancelInvitation)
	invitations.Post("/accept", h.AcceptInvitation)
}

func (h *InvitationHandler) ListInvitations(c fiber.Ctx) error {
	tenantIDStr, ok := c.Locals("tenant_id").(string)
	if !ok {
		return fiber.ErrBadRequest
	}

	tenantID, err := uuid.Parse(tenantIDStr)
	if err != nil {
		return fiber.ErrBadRequest
	}

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	status := c.Query("status", "")

	invitations, total, err := h.invitationService.List(c.RequestCtx(), tenantID, page, limit, status)
	if err != nil {
		return handleInvitationError(err)
	}

	return c.JSON(fiber.Map{
		"data":  invitations,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func (h *InvitationHandler) CreateInvitation(c fiber.Ctx) error {
	tenantIDStr, ok := c.Locals("tenant_id").(string)
	if !ok {
		return fiber.ErrBadRequest
	}

	tenantID, err := uuid.Parse(tenantIDStr)
	if err != nil {
		return fiber.ErrBadRequest
	}

	var req struct {
		Email      string `json:"email"`
		Role       string `json:"role"`
		FullName   string `json:"full_name"`
		Department string `json:"department"`
		Batch      string `json:"batch"`
	}

	if err := c.Bind().Body(&req); err != nil {
		return fiber.ErrBadRequest
	}

	currentUserID, ok := c.Locals("user_id").(string)
	if !ok {
		return fiber.ErrUnauthorized
	}

	currentUserIDUUID, err := uuid.Parse(currentUserID)
	if err != nil {
		return fiber.ErrUnauthorized
	}

	invitation, err := h.invitationService.Create(
		c.RequestCtx(),
		tenantID,
		req.Email,
		req.Role,
		req.FullName,
		req.Department,
		req.Batch,
		currentUserIDUUID,
	)
	if err != nil {
		return handleInvitationError(err)
	}

	return c.Status(fiber.StatusCreated).JSON(invitation)
}

func (h *InvitationHandler) GetInvitation(c fiber.Ctx) error {
	invitationIDStr := c.Params("id")
	invitationID, err := uuid.Parse(invitationIDStr)
	if err != nil {
		return fiber.ErrBadRequest
	}

	invitation, err := h.invitationService.GetByID(c.RequestCtx(), invitationID)
	if err != nil {
		return handleInvitationError(err)
	}

	return c.JSON(invitation)
}

func (h *InvitationHandler) ResendInvitation(c fiber.Ctx) error {
	invitationIDStr := c.Params("id")
	invitationID, err := uuid.Parse(invitationIDStr)
	if err != nil {
		return fiber.ErrBadRequest
	}

	invitation, err := h.invitationService.Resend(c.RequestCtx(), invitationID)
	if err != nil {
		return handleInvitationError(err)
	}

	return c.JSON(invitation)
}

func (h *InvitationHandler) CancelInvitation(c fiber.Ctx) error {
	invitationIDStr := c.Params("id")
	invitationID, err := uuid.Parse(invitationIDStr)
	if err != nil {
		return fiber.ErrBadRequest
	}

	if err := h.invitationService.Cancel(c.RequestCtx(), invitationID); err != nil {
		return handleInvitationError(err)
	}

	return c.SendStatus(fiber.StatusNoContent)
}

func (h *InvitationHandler) AcceptInvitation(c fiber.Ctx) error {
	var req struct {
		Code string `json:"code"`
	}

	if err := c.Bind().Body(&req); err != nil {
		return fiber.ErrBadRequest
	}

	invitation, err := h.invitationService.Accept(c.RequestCtx(), req.Code)
	if err != nil {
		return handleInvitationError(err)
	}

	return c.JSON(invitation)
}

func handleInvitationError(err error) error {
	switch err {
	case service.ErrInvitationNotFound:
		return fiber.NewError(fiber.StatusNotFound, "Invitation not found")
	case service.ErrInvitationExpired:
		return fiber.NewError(fiber.StatusGone, "Invitation expired")
	case service.ErrInvitationCancelled:
		return fiber.NewError(fiber.StatusConflict, "Invitation cancelled")
	case service.ErrInvitationUsed:
		return fiber.NewError(fiber.StatusConflict, "Invitation already used")
	default:
		return err
	}
}
