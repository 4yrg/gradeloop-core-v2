package router

import (
	"github.com/4yrg/gradeloop-core-v2/apps/services/cipas/cipas-xai/internal/handler"
	"github.com/gofiber/fiber/v3"
)

type Config struct {
	ChatHandler *handler.ChatHandler
}

func SetupRoutes(app *fiber.App, cfg Config) {
	// API V1 Group
	v1 := app.Group("/api/v1")

	// CIPAS XAI Service Group
	xai := v1.Group("/cipas-xai")

	// Chat routes
	xai.Post("/chat", cfg.ChatHandler.Chat)
	xai.Post("/chat/stream", cfg.ChatHandler.ChatStream)

	// Root endpoint for health check
	xai.Get("/", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"service": "cipas-xai",
			"version": "1.0.0",
			"status":  "running",
		})
	})

	// Health check endpoint
	xai.Get("/health", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status": "healthy",
		})
	})
}
