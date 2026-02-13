package router

import (
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/application/ports"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/http/handlers"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/http/middleware"
	"github.com/gofiber/fiber/v3"
	"github.com/redis/go-redis/v9"
)

func Setup(app *fiber.App, userHandler *handlers.UserHandler, roleHandler *handlers.RoleHandler, permissionHandler *handlers.PermissionHandler, authHandler interface{}, redisClient *redis.Client, auditRepo ports.AuditRepository) {
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

	// Auth Routes - register only if authHandler provided (auth may be handled by a separate service)
	if authHandler != nil {
		if ah, ok := authHandler.(interface {
			Login(c fiber.Ctx) error
			Refresh(c fiber.Ctx) error
			RevokeToken(c fiber.Ctx) error
			Activate(c fiber.Ctx) error
			RequestActivation(c fiber.Ctx) error
			ForgotPassword(c fiber.Ctx) error
			ResetPassword(c fiber.Ctx) error
			ValidateToken(c fiber.Ctx) error
			StoreTokens(c fiber.Ctx) error
			ClearTokens(c fiber.Ctx) error
			ValidateSession(c fiber.Ctx) error
			Logout(c fiber.Ctx) error
		}); ok {
			auth := v1.Group("/auth")
			auth.Post("/login", ah.Login)
			auth.Post("/refresh", ah.Refresh)
			auth.Delete("/refresh-tokens/:token_id", ah.RevokeToken)
			auth.Post("/activate", activationLimiter, ah.Activate)
			auth.Post("/request-activation", activationLimiter, ah.RequestActivation)
			auth.Post("/forgot-password", activationLimiter, ah.ForgotPassword)
			auth.Post("/reset-password", ah.ResetPassword)
			auth.Get("/validate", ah.ValidateToken) // ForwardAuth endpoint for Traefik
			auth.Post("/store-tokens", ah.StoreTokens)
			auth.Post("/clear-tokens", ah.ClearTokens)
			auth.Get("/session", ah.ValidateSession)
			auth.Post("/logout", ah.Logout)
		}
	}

	users := v1.Group("/users")

	// Rate limiting for /users POST is disabled in router (handled elsewhere if needed)
	var postLimiter fiber.Handler = func(c fiber.Ctx) error { return c.Next() }

	users.Post("/", postLimiter, userHandler.CreateUser)
	users.Get("/", userHandler.ListUsers)
	users.Get("/:id", userHandler.GetUser)
	users.Put("/:id", userHandler.UpdateUser)
	users.Delete("/:id", userHandler.DeleteUser)
	users.Patch("/:id/restore", userHandler.RestoreUser)
	// Token revocation and protected user endpoints are only available when authHandler is enabled
	if authHandler != nil {
		if ah, ok := authHandler.(interface {
			RevokeAllTokens(c fiber.Ctx) error
			ChangePassword(c fiber.Ctx) error
		}); ok {
			users.Post("/:id/revoke-all-tokens", ah.RevokeAllTokens)

			// Protected user endpoints requiring authentication
			protectedUsers := users.Group("/me", middleware.AuthRequired())
			protectedUsers.Patch("/password", ah.ChangePassword)
		}
	}

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
