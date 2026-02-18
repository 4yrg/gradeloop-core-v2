package router

import (
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/handler"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/middleware"
	"github.com/gofiber/fiber/v3"
)

type Config struct {
	UserHandler  *handler.UserHandler
	AuthHandler  *handler.AuthHandler
	RoleHandler  *handler.RoleHandler
	AuditHandler *handler.AuditHandler
	RBAC         *middleware.RBACMiddleware
}

func SetupRoutes(app *fiber.App, config Config) {
	// Global Middleware
	// app.Use(logger.New()) // if desired

	// CSRF middleware for protecting mutating requests
	// Note: Applied selectively to protected routes that modify state
	csrf := middleware.CSRFMiddleware()

	// Public Routes
	auth := app.Group("/auth")
	auth.Post("/login", config.AuthHandler.Login)
	auth.Post("/refresh", config.AuthHandler.Refresh)
	auth.Post("/logout", config.AuthHandler.Logout) // Could add CSRF here if desired
	auth.Post("/request-reset", config.AuthHandler.RequestPasswordReset)
	auth.Post("/reset-password", config.AuthHandler.ResetPassword)
	auth.Post("/change-password", middleware.AuthMiddleware(), csrf, config.AuthHandler.ChangePassword)
	auth.Get("/session", middleware.AuthMiddleware(), config.AuthHandler.Session)

	// Protected Routes
	// Authorization Middleware Check
	// We assume AuthMiddleware sets user_id in locals.

	// Apply both Auth and CSRF middleware to mutating operations
	// Using canonical permission format: iam:resource:action
	users := app.Group("/users", middleware.AuthMiddleware())
	users.Post("/", csrf, config.RBAC.RequirePermission(domain.PermissionUsersCreate), config.UserHandler.CreateUser)
	users.Get("/", csrf, config.RBAC.RequirePermission(domain.PermissionUsersRead), config.UserHandler.ListUsers)
	users.Get("/:id", csrf, config.RBAC.RequirePermission(domain.PermissionUsersRead), config.UserHandler.GetUser)
	users.Put("/:id", csrf, config.RBAC.RequirePermission(domain.PermissionUsersUpdate), config.UserHandler.UpdateUser)
	users.Delete("/:id", csrf, config.RBAC.RequirePermission(domain.PermissionUsersDelete), config.UserHandler.DeleteUser)
	users.Post("/:id/roles", csrf, config.RBAC.RequirePermission(domain.PermissionRolesAssign), config.UserHandler.AssignRole)

	roles := app.Group("/roles", middleware.AuthMiddleware())
	roles.Post("/", csrf, config.RBAC.RequireRole("SUPER_ADMIN"), config.RoleHandler.CreateRole)
	roles.Get("/", csrf, config.RBAC.RequirePermission(domain.PermissionRolesRead), config.RoleHandler.ListRoles)
	roles.Post("/:id/permissions", csrf, config.RBAC.RequireRole("SUPER_ADMIN"), config.RoleHandler.AssignPermission)

	// Audit Logs
	audit := app.Group("/audit-logs", middleware.AuthMiddleware())
	audit.Get("/", csrf, config.RBAC.RequireRole("SUPER_ADMIN"), config.AuditHandler.ListLogs)

}
