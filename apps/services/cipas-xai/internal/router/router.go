package router

import (
	"github.com/4yrg/gradeloop-core-v2/apps/services/cipas/cipas-xai/internal/handler"
	"github.com/gofiber/fiber/v3"
)

type Config struct {
	ChatHandler *handler.ChatHandler
}

func SetupRoutes(app *fiber.App, cfg Config) {
	// Register chat routes
	cfg.ChatHandler.RegisterRoutes(app)

	// Root endpoint for health check
	app.Get("/", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"service": "cipas-xai",
			"version": "1.0.0",
			"status":  "running",
		})
	})

	// Health check endpoint
	app.Get("/health", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status": "healthy",
		})
	})
}
