package http

import (
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/application/ports"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/http/handlers"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/http/router"
	gl_logger "github.com/4YRG/gradeloop-core-v2/shared/libs/go/logger"
	gl_middleware "github.com/4YRG/gradeloop-core-v2/shared/libs/go/middleware"
	"github.com/go-redis/redis/v8"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/recover"
)

func Start(userHandler *handlers.UserHandler, roleHandler *handlers.RoleHandler, permissionHandler *handlers.PermissionHandler, authHandler *handlers.AuthHandler, redisClient *redis.Client, auditRepo ports.AuditRepository) {
	app := fiber.New()
	l := gl_logger.New("iam-service")

	// FiberTrace must be first to ensure trace_id is available for all subsequent logs and middlewares
	app.Use(gl_middleware.FiberTrace("iam-service"))
	app.Use(gl_middleware.Prometheus("iam-service"))
	app.Use(recover.New())

	// Metrics endpoint for Prometheus scraping
	app.Get("/api/metrics", gl_middleware.PrometheusHandler())

	router.Setup(app, userHandler, roleHandler, permissionHandler, authHandler, redisClient, auditRepo)

	l.Info("Server starting on :3000")
	if err := app.Listen(":3000"); err != nil {
		l.Error("Error starting server", "error", err)
	}
}
