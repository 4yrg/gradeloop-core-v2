package router

import (
	"time"

	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/http/handlers"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/limiter"
)

func Setup(app *fiber.App, userHandler *handlers.UserHandler) {
	// API Group
	api := app.Group("/api")
	v1 := api.Group("/v1")

	users := v1.Group("/users")

	// Rate Limit: 10 req/min for /users (POST)
	postLimiter := limiter.New(limiter.Config{
		Max:        10,
		Expiration: 1 * time.Minute,
	})

	users.Post("/", postLimiter, userHandler.CreateUser)
	users.Get("/", userHandler.ListUsers)
	users.Get("/:id", userHandler.GetUser)
	users.Put("/:id", userHandler.UpdateUser)
	users.Delete("/:id", userHandler.DeleteUser)
}
