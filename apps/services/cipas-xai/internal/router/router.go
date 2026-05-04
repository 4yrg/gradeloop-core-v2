package router

import (
	"github.com/4yrg/gradeloop-core-v2/apps/services/cipas/cipas-xai/internal/handler"
	"github.com/gofiber/fiber/v3"
)

type Config struct {
	ReasonHandler *handler.ReasonHandler
}

func SetupRoutes(app *fiber.App, cfg Config) {
	// API V1 Group
	v1 := app.Group("/api/v1")

	// CIPAS XAI Service Group
	xai := v1.Group("/cipas-xai")

	// Reasoning route
	xai.Post("/reason", cfg.ReasonHandler.Reason)

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
