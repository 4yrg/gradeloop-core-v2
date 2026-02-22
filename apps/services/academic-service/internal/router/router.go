package router

import (
	"github.com/gofiber/fiber/v3"
	"github.com/gradeloop/academic-service/internal/handler"
	"github.com/gradeloop/academic-service/internal/middleware"
)

type Config struct {
	HealthHandler *handler.HealthHandler
	JWTSecretKey  []byte
}

func SetupRoutes(app *fiber.App, cfg Config) {
	cfg.HealthHandler.RegisterRoutes(app)

	// API v1 group
	api := app.Group("/api/v1")

	// Protected routes (require authentication)
	protected := api.Group("", middleware.AuthMiddleware(cfg.JWTSecretKey))

	// Add your academic service routes here
	_ = protected

	app.Get("/", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"service": "academic-service",
			"version": "1.0.0",
			"status":  "running",
		})
	})
}
