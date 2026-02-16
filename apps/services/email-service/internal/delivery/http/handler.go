package http

import (
	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"github.com/gradeloop/email-service/internal/domain"
)

type Handler struct {
	service domain.EmailService
}

func NewHandler(service domain.EmailService) *Handler {
	return &Handler{service: service}
}

func (h *Handler) SendEmail(c fiber.Ctx) error {
	var req domain.SendEmailRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if err := h.service.SendEmail(c.Context(), &req); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{"message": "Email queued for sending"})
}

func (h *Handler) CreateTemplate(c fiber.Ctx) error {
	var req domain.CreateTemplateRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	tmpl, err := h.service.CreateTemplate(c.Context(), &req)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(fiber.StatusCreated).JSON(tmpl)
}

func (h *Handler) GetTemplate(c fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid UUID"})
	}

	tmpl, err := h.service.GetTemplate(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Template not found"})
	}

	return c.Status(fiber.StatusOK).JSON(tmpl)
}

func (h *Handler) GetStatus(c fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid UUID"})
	}

	msg, err := h.service.GetEmailStatus(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Message not found"})
	}

	return c.Status(fiber.StatusOK).JSON(msg)
}
