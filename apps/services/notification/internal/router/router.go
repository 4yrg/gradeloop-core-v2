package router

import (
	"github.com/4yrg/gradeloop-core-v2/apps/services/notification/internal/handler"
	"github.com/4yrg/gradeloop-core-v2/apps/services/notification/internal/middleware"
	"github.com/gofiber/fiber/v3"
)

type Config struct {
	HealthHandler       *handler.HealthHandler
	NotificationHandler *handler.NotificationHandler
	SSEHandler          *handler.SSEHandler
	JWTSecretKey        []byte
}

func SetupRoutes(app *fiber.App, cfg Config) {
	cfg.HealthHandler.RegisterRoutes(app)

	app.Get("/", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"service": "notification-service",
			"version": "1.0.0",
			"status":  "running",
		})
	})

	api := app.Group("/api/v1")

	protected := api.Group("", middleware.AuthMiddleware(cfg.JWTSecretKey))

	protected.Get("/debug/auth", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"user_id":       c.Locals("user_id"),
			"username":      c.Locals("username"),
			"user_type":     c.Locals("user_type"),
			"authenticated": true,
		})
	})

	notifications := protected.Group("/notifications")
	notifications.Get("/", cfg.NotificationHandler.List)
	notifications.Get("/unread-count", cfg.NotificationHandler.GetUnreadCount)
	notifications.Patch("/:id/read", cfg.NotificationHandler.MarkAsRead)
	notifications.Patch("/read-all", cfg.NotificationHandler.MarkAllAsRead)
	notifications.Delete("/:id", cfg.NotificationHandler.Delete)

	protected.Get("/notifications/stream", cfg.SSEHandler.Stream)
}