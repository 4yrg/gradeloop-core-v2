package handler

import (
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/service"
	"github.com/gofiber/fiber/v3"
)

type Handler interface {
	RegisterRoutes(app *fiber.App)
}

type BaseHandler struct {
	Service service.Service
}

func NewBaseHandler(service service.Service) *BaseHandler {
	return &BaseHandler{
		Service: service,
	}
}

func (h *BaseHandler) RegisterRoutes(app *fiber.App) {
}
