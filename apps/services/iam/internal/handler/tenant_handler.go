package handler

import (
	"strconv"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/service"
	"github.com/google/uuid"
	"github.com/gofiber/fiber/v3"
)

type TenantHandler struct {
	tenantService service.TenantService
}

func NewTenantHandler(tenantService service.TenantService) *TenantHandler {
	return &TenantHandler{tenantService: tenantService}
}

func (h *TenantHandler) RegisterRoutes(router fiber.Router) {
	tenants := router.Group("/tenants")

	tenants.Get("/", h.ListTenants)
	tenants.Post("/", h.CreateTenant)
	tenants.Get("/:id", h.GetTenant)
	tenants.Put("/:id", h.UpdateTenant)
	tenants.Delete("/:id", h.DeleteTenant)
	tenants.Get("/:id/stats", h.GetTenantStats)
	tenants.Get("/resolve", h.ResolveByDomain)
}

func (h *TenantHandler) ListTenants(c fiber.Ctx) error {
	userType, _ := c.Locals("user_type").(string)
	if userType != "super_admin" {
		return fiber.NewError(fiber.StatusForbidden, "Super admin access required")
	}

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	search := c.Query("search", "")

	tenants, total, err := h.tenantService.ListTenants(c.RequestCtx(), page, limit, search)
	if err != nil {
		return handleTenantError(err)
	}

	return c.JSON(fiber.Map{
		"data":  tenants,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

func (h *TenantHandler) CreateTenant(c fiber.Ctx) error {
	userType, _ := c.Locals("user_type").(string)
	if userType != "super_admin" {
		return fiber.NewError(fiber.StatusForbidden, "Super admin access required")
	}

	var req struct {
		Name      string `json:"name"`
		Slug     string `json:"slug"`
		Domain   string `json:"domain"`
		Settings string `json:"settings,omitempty"`
	}

	if err := c.Bind().Body(&req); err != nil {
		return fiber.ErrBadRequest
	}

	tenant, err := h.tenantService.CreateTenant(c.RequestCtx(), req.Name, req.Slug, req.Domain, req.Settings)
	if err != nil {
		return handleTenantError(err)
	}

	return c.Status(fiber.StatusCreated).JSON(tenant)
}

func (h *TenantHandler) GetTenant(c fiber.Ctx) error {
	tenantID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	tenant, err := h.tenantService.GetTenant(c.RequestCtx(), tenantID)
	if err != nil {
		return handleTenantError(err)
	}

	return c.JSON(tenant)
}

func (h *TenantHandler) UpdateTenant(c fiber.Ctx) error {
	userType, _ := c.Locals("user_type").(string)
	if userType != "super_admin" {
		return fiber.NewError(fiber.StatusForbidden, "Super admin access required")
	}

	tenantID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	var req struct {
		Name      string `json:"name,omitempty"`
		Domain   string `json:"domain,omitempty"`
		IsActive *bool  `json:"is_active,omitempty"`
		Settings string `json:"settings,omitempty"`
	}

	if err := c.Bind().Body(&req); err != nil {
		return fiber.ErrBadRequest
	}

	tenant, err := h.tenantService.UpdateTenant(c.RequestCtx(), tenantID, req.Name, req.Domain, req.IsActive, req.Settings)
	if err != nil {
		return handleTenantError(err)
	}

	return c.JSON(tenant)
}

func (h *TenantHandler) DeleteTenant(c fiber.Ctx) error {
	userType, _ := c.Locals("user_type").(string)
	if userType != "super_admin" {
		return fiber.NewError(fiber.StatusForbidden, "Super admin access required")
	}

	tenantID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}

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

	tenantID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return fiber.ErrBadRequest
	}

	stats, err := h.tenantService.GetTenantStats(c.RequestCtx(), tenantID)
	if err != nil {
		return handleTenantError(err)
	}

	return c.JSON(stats)
}

func (h *TenantHandler) ResolveByDomain(c fiber.Ctx) error {
	domain := c.Query("domain", "")
	if domain == "" {
		return fiber.ErrBadRequest
	}

	tenant, err := h.tenantService.ResolveByDomain(c.RequestCtx(), domain)
	if err != nil {
		return handleTenantError(err)
	}

	return c.JSON(tenant)
}

func handleTenantError(err error) error {
	switch err.Error() {
	case "tenant not found":
		return fiber.NewError(fiber.StatusNotFound, "Tenant not found")
	case "tenant already exists":
		return fiber.NewError(fiber.StatusConflict, "Tenant already exists")
	case "invalid tenant slug":
		return fiber.NewError(fiber.StatusBadRequest, "Invalid tenant slug")
	default:
		return err
	}
}