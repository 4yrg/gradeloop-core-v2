package http

import (
	"log"

	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/http/handlers"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/http/router"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/logger"
	"github.com/gofiber/fiber/v3/middleware/recover"
)

func Start(userHandler *handlers.UserHandler, roleHandler *handlers.RoleHandler) {
	app := fiber.New()

	app.Use(logger.New())
	app.Use(recover.New())

	router.Setup(app, userHandler, roleHandler)

	log.Println("Server starting on :3000")
	if err := app.Listen(":3000"); err != nil {
		log.Fatalf("Error starting server: %v", err)
	}
}
