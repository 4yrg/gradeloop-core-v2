package handler

import (
	"strconv"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/dto"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/service"
	"github.com/gofiber/fiber/v3"
)

type TenantHandler struct {
	tenantService service.TenantService
}

func NewTenantHandler(tenantService service.TenantService) *TenantHandler {
	return &TenantHandler{
		tenantService: tenantService,
	}
}

func (h *TenantHandler) RegisterRoutes(router fiber.Router) {
	tenants := router.Group("/tenants")

	tenants.Get("/resolve", h.ResolveByDomain)

	tenants.Get("/", h.GetTenants)
	tenants.Post("/", h.CreateTenant)
	tenants.Get("/:id", h.GetTenant)
	tenants.Put("/:id", h.UpdateTenant)
	tenants.Delete("/:id", h.DeleteTenant)
	tenants.Get("/:id/stats", h.GetTenantStats)
}

func (h *TenantHandler) GetTenants(c fiber.Ctx) error {
	userType, _ := c.Locals("user_type").(string)
	if userType != "super_admin" {
		return fiber.NewError(fiber.StatusForbidden, "Super admin access required")
	}

	page, _ := strconv.Atoi(c.Query("page", "1"))
	if page < 1 {
		page = 1
	}

	limit, _ := strconv.Atoi(c.Query("limit", "10"))
	if limit < 1 {
		limit = 10
	}
	if limit > 100 {
		limit = 100
	}

	search := c.Query("search", "")

	response, err := h.tenantService.ListTenants(c.RequestCtx(), page, limit, search)
	if err != nil {
		return handleTenantError(err)
	}

	return c.JSON(response)
}

func (h *TenantHandler) CreateTenant(c fiber.Ctx) error {
	userType, _ := c.Locals("user_type").(string)
	if userType != "super_admin" {
		return fiber.NewError(fiber.StatusForbidden, "Super admin access required")
	}

	var req dto.CreateTenantRequest

	if err := c.Bind().Body(&req); err != nil {
		return fiber.ErrBadRequest
	}

	response, err := h.tenantService.CreateTenant(c.RequestCtx(), &req)
	if err != nil {
		return handleTenantError(err)
	}

	return c.Status(fiber.StatusCreated).JSON(response)
}

func (h *TenantHandler) GetTenant(c fiber.Ctx) error {
	tenantID := c.Params("id")

	response, err := h.tenantService.GetTenant(c.RequestCtx(), tenantID)
	if err != nil {
		return handleTenantError(err)
	}

	return c.JSON(response)
}

func (h *TenantHandler) UpdateTenant(c fiber.Ctx) error {
	userType, _ := c.Locals("user_type").(string)
	if userType != "super_admin" {
		return fiber.NewError(fiber.StatusForbidden, "Super admin access required")
	}

	tenantID := c.Params("id")
	var req dto.UpdateTenantRequest

	if err := c.Bind().Body(&req); err != nil {
		return fiber.ErrBadRequest
	}

	response, err := h.tenantService.UpdateTenant(c.RequestCtx(), tenantID, &req)
	if err != nil {
		return handleTenantError(err)
	}

	return c.JSON(response)
}

func (h *TenantHandler) DeleteTenant(c fiber.Ctx) error {
	userType, _ := c.Locals("user_type").(string)
	if userType != "super_admin" {
		return fiber.NewError(fiber.StatusForbidden, "Super admin access required")
	}

	tenantID := c.Params("id")

	if err := h.tenantService.DeleteTenant(c.RequestCtx(), tenantID); err != nil {
		return handleTenantError(err)
	}

	return c.SendStatus(fiber.StatusNoContent)
}

func (h *TenantHandler) GetTenantStats(c fiber.Ctx) error {
	userType, _ := c.Locals("user_type").(string)
	if userType != "super_admin" {
		return fiber.NewError(fiber.StatusForbidden, "Super admin access required")
	}

	tenantID := c.Params("id")

	response, err := h.tenantService.GetTenantStats(c.RequestCtx(), tenantID)
	if err != nil {
		return handleTenantError(err)
	}

	return c.JSON(response)
}

func (h *TenantHandler) ResolveByDomain(c fiber.Ctx) error {
	domain := c.Query("domain", "")

	response, err := h.tenantService.ResolveTenantByDomain(c.RequestCtx(), domain)
	if err != nil {
		return handleTenantError(err)
	}

	return c.JSON(response)
}

func handleTenantError(err error) error {
	switch err {
	case service.ErrTenantNotFound:
		return fiber.NewError(fiber.StatusNotFound, "Tenant not found")
	case service.ErrTenantExists:
		return fiber.NewError(fiber.StatusConflict, "Tenant already exists")
	case service.ErrInvalidSlug:
		return fiber.NewError(fiber.StatusBadRequest, "Invalid tenant slug")
	default:
		return err
	}
}