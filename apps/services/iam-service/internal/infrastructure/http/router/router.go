package router

import (
	"os"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/application/ports"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/http/handlers"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/http/middleware"
	"github.com/gofiber/fiber/v3"
	"github.com/redis/go-redis/v9"
)

func Setup(app *fiber.App, userHandler *handlers.UserHandler, roleHandler *handlers.RoleHandler, permissionHandler *handlers.PermissionHandler, authHandler *handlers.AuthHandler, redisClient *redis.Client, auditRepo ports.AuditRepository) {
	// Keep parameters to preserve call signature; rate limiting handled elsewhere.
	_ = redisClient
	_ = auditRepo
	// Health endpoint
	app.Get("/api/iam/health", func(c fiber.Ctx) error {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{"status": "ok"})
	})
	// API Group
	api := app.Group("/api")
	v1 := api.Group("/v1")

	// Activation rate limiter disabled in router (handled elsewhere if needed)
	var activationLimiter fiber.Handler = func(c fiber.Ctx) error { return c.Next() }

	// Auth Routes
	auth := v1.Group("/auth")
	auth.Post("/login", authHandler.Login)
	auth.Post("/refresh", authHandler.Refresh)
	auth.Delete("/refresh-tokens/:token_id", authHandler.RevokeToken)
	auth.Post("/activate", activationLimiter, authHandler.Activate)
	auth.Post("/request-activation", activationLimiter, authHandler.RequestActivation)
	auth.Post("/forgot-password", activationLimiter, authHandler.ForgotPassword)
	auth.Post("/reset-password", authHandler.ResetPassword)
	auth.Get("/validate", authHandler.ValidateToken) // ForwardAuth endpoint for Traefik
	auth.Post("/store-tokens", authHandler.StoreTokens)
	auth.Post("/clear-tokens", authHandler.ClearTokens)
	auth.Get("/session", authHandler.ValidateSession)
	auth.Post("/logout", authHandler.Logout)

	users := v1.Group("/users")

	// Rate limiting for /users POST is disabled in router (handled elsewhere if needed)
	var postLimiter fiber.Handler = func(c fiber.Ctx) error { return c.Next() }

	users.Post("/", postLimiter, userHandler.CreateUser)
	users.Get("/", userHandler.ListUsers)
	users.Get("/:id", userHandler.GetUser)
	users.Put("/:id", userHandler.UpdateUser)
	users.Delete("/:id", userHandler.DeleteUser)
	users.Patch("/:id/restore", userHandler.RestoreUser)
	users.Post("/:id/revoke-all-tokens", authHandler.RevokeAllTokens)

	// Protected user endpoints requiring authentication
	protectedUsers := users.Group("/me", middleware.AuthRequired())
	protectedUsers.Patch("/password", authHandler.ChangePassword)

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
