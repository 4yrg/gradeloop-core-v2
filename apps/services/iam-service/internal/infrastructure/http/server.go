package http

import (
	"os"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/application/ports"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/http/handlers"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/http/router"
	gl_logger "github.com/4yrg/gradeloop-core-v2/shared/libs/go/logger"
	gl_middleware "github.com/4yrg/gradeloop-core-v2/shared/libs/go/middleware"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/recover"
	"github.com/redis/go-redis/v9"
)

func Start(userHandler *handlers.UserHandler, roleHandler *handlers.RoleHandler, permissionHandler *handlers.PermissionHandler, authHandler interface{}, redisClient *redis.Client, auditRepo ports.AuditRepository) {
	app := fiber.New()
	l := gl_logger.New("iam-service")

	// FiberTrace must be first to ensure trace_id is available for all subsequent logs and middlewares
	app.Use(gl_middleware.FiberTrace("iam-service"))

	// CORS middleware for cross-origin requests with credentials
	webAppOrigin := os.Getenv("WEB_APP_ORIGIN")
	if webAppOrigin == "" {
		webAppOrigin = "http://localhost:3001" // Default for development
	}

	app.Use(cors.New(cors.Config{
		AllowOrigins:     []string{webAppOrigin},
		AllowCredentials: true,
		AllowMethods:     []string{"GET", "POST", "HEAD", "PUT", "DELETE", "PATCH", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Requested-With", "X-CSRF-Token", "X-Request-Time"},
		ExposeHeaders:    []string{"Content-Length", "X-User-Id", "X-User-Roles", "X-User-Permissions"},
		MaxAge:           86400, // 24 hours
	}))

	app.Use(recover.New())

	router.Setup(app, userHandler, roleHandler, permissionHandler, authHandler, redisClient, auditRepo)

	l.Info("Server starting on :3000")
	if err := app.Listen(":3000"); err != nil {
		l.Error("Error starting server", "error", err)
	}
}
