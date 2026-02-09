package router

import (
	"time"

	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/http/handlers"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/http/middleware"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/limiter"
)

func Setup(app *fiber.App, userHandler *handlers.UserHandler, roleHandler *handlers.RoleHandler, permissionHandler *handlers.PermissionHandler, authHandler *handlers.AuthHandler) {
	// API Group
	api := app.Group("/api")
	v1 := api.Group("/v1")

	// Auth Routes
	v1.Post("/login", authHandler.Login)
	v1.Post("/refresh", authHandler.Refresh)
	v1.Delete("/refresh-tokens/:token_id", authHandler.RevokeToken)

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
	users.Post("/:id/revoke-all-tokens", authHandler.RevokeAllTokens)

	// Role Management Routes (Protected by AdminOnly)
	roles := v1.Group("/roles", middleware.AdminOnly())
	roles.Post("/", roleHandler.CreateRole)
	roles.Get("/", roleHandler.ListRoles)
	roles.Patch("/:id/permissions", roleHandler.UpdatePermissions)
	roles.Delete("/:id", roleHandler.DeleteRole)

	// Permission Catalog Routes (Read-Only)
	permissions := v1.Group("/permissions")
	permissions.Get("/", permissionHandler.ListPermissions)
	permissions.Get("/:name", permissionHandler.GetPermissionByName)

	// Explicitly block modification attempts on the permission catalog (Requirement: 405 Method Not Allowed)
	permissions.Post("/", func(c fiber.Ctx) error { return c.SendStatus(fiber.StatusMethodNotAllowed) })
	permissions.Put("/:name", func(c fiber.Ctx) error { return c.SendStatus(fiber.StatusMethodNotAllowed) })
	permissions.Patch("/:name", func(c fiber.Ctx) error { return c.SendStatus(fiber.StatusMethodNotAllowed) })
	permissions.Delete("/:name", func(c fiber.Ctx) error { return c.SendStatus(fiber.StatusMethodNotAllowed) })
}
