package handler

import (
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/domain"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/service"
	"github.com/google/uuid"
	"github.com/gofiber/fiber/v3"
)

type MFAHandler struct {
	mfaService service.MFAService
}

func NewMFAHandler(mfaService service.MFAService) *MFAHandler {
	return &MFAHandler{mfaService: mfaService}
}

func (h *MFAHandler) RegisterRoutes(router fiber.Router) {
	mfa := router.Group("/auth/mfa")
	mfa.Post("/generate", h.GenerateSecret)
	mfa.Post("/enable", h.EnableMFA)
	mfa.Post("/verify", h.VerifyMFA)
	mfa.Post("/disable", h.DisableMFA)
	mfa.Get("/status", h.GetMFAStatus)
}

func (h *MFAHandler) GenerateSecret(c fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok {
		return fiber.ErrUnauthorized
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return fiber.ErrUnauthorized
	}

	secret, err := h.mfaService.GenerateSecret(c.RequestCtx(), userUUID)
	if err != nil {
		return handleMFAError(err)
	}

	return c.JSON(fiber.Map{
		"secret": secret,
		"message": "MFA secret generated. Please configure your authenticator app.",
	})
}

func (h *MFAHandler) EnableMFA(c fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok {
		return fiber.ErrUnauthorized
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return fiber.ErrUnauthorized
	}

	var req struct {
		Secret string `json:"secret"`
		Code   string `json:"code"`
	}

	if err := c.Bind().Body(&req); err != nil {
		return fiber.ErrBadRequest
	}

	if err := h.mfaService.Enable(c.RequestCtx(), userUUID, req.Secret, req.Code); err != nil {
		return handleMFAError(err)
	}

	return c.JSON(fiber.Map{"message": "MFA enabled successfully"})
}

func (h *MFAHandler) VerifyMFA(c fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok {
		return fiber.ErrUnauthorized
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return fiber.ErrUnauthorized
	}

	var req struct {
		Code string `json:"code"`
	}

	if err := c.Bind().Body(&req); err != nil {
		return fiber.ErrBadRequest
	}

	valid, err := h.mfaService.Verify(c.RequestCtx(), userUUID, req.Code)
	if err != nil {
		return handleMFAError(err)
	}

	if !valid {
		return fiber.NewError(fiber.StatusUnauthorized, "Invalid verification code")
	}

	return c.JSON(fiber.Map{"message": "Verification successful"})
}

func (h *MFAHandler) DisableMFA(c fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok {
		return fiber.ErrUnauthorized
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return fiber.ErrUnauthorized
	}

	if err := h.mfaService.Disable(c.RequestCtx(), userUUID); err != nil {
		return handleMFAError(err)
	}

	return c.JSON(fiber.Map{"message": "MFA disabled successfully"})
}

func (h *MFAHandler) GetMFAStatus(c fiber.Ctx) error {
	userID, ok := c.Locals("user_id").(string)
	if !ok {
		return fiber.ErrUnauthorized
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return fiber.ErrUnauthorized
	}

	mfa, err := h.mfaService.GetConfig(c.RequestCtx(), userUUID)
	if err != nil {
		// Return disabled if not found
		return c.JSON(fiber.Map{
			"enabled": false,
			"status":  domain.MFAStatusDisabled,
		})
	}

	return c.JSON(fiber.Map{
		"enabled":  mfa.IsEnabled(),
		"status":  mfa.Status,
	})
}

func handleMFAError(err error) error {
	switch err {
	case service.ErrMFANotFound:
		return fiber.NewError(fiber.StatusNotFound, "MFA not configured")
	case service.ErrMFAAlreadyEnabled:
		return fiber.NewError(fiber.StatusConflict, "MFA already enabled")
	case service.ErrMFANotEnabled:
		return fiber.NewError(fiber.StatusBadRequest, "MFA not enabled")
	case service.ErrInvalidMFACode:
		return fiber.NewError(fiber.StatusUnauthorized, "Invalid verification code")
	default:
		return err
	}
}