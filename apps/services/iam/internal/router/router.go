package router

import (
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/config"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/handler"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam/internal/middleware"
	"github.com/gofiber/fiber/v3"
)

type Config struct {
	HealthHandler      *handler.HealthHandler
	AuthHandler       *handler.AuthHandler
	UserHandler      *handler.UserHandler
	BulkImportHandler *handler.BulkImportHandler
	SSOHandler       *handler.SSOHandler
	JWTSecretKey     []byte
	ZeroTrustConfig  *config.ZeroTrustConfig
}

func SetupRoutes(app *fiber.App, cfg Config) {
	cfg.HealthHandler.RegisterRoutes(app)

	api := app.Group("/api/v1")

	publicAuth := api.Group("/auth")
	publicAuth.Post("/login", cfg.AuthHandler.Login)
	publicAuth.Post("/refresh", cfg.AuthHandler.RefreshToken)
	publicAuth.Post("/logout", cfg.AuthHandler.Logout)
	publicAuth.Post("/forgot-password", cfg.AuthHandler.ForgotPassword)
	publicAuth.Post("/reset-password", cfg.AuthHandler.ResetPassword)

	if cfg.SSOHandler != nil {
		sso := publicAuth.Group("/sso")
		sso.Get("/", cfg.SSOHandler.HandleListProviders)
		sso.Get("/:provider", cfg.SSOHandler.HandleSSOInitiate)
		sso.Get("/:provider/callback", cfg.SSOHandler.HandleSSOCallback)
		ssoProtected := sso.Group("", middleware.AuthMiddleware(cfg.JWTSecretKey))
		ssoProtected.Get("/userinfo", cfg.SSOHandler.HandleUserInfo)
	}

	authMiddleware := []fiber.Handler{middleware.AuthMiddleware(cfg.JWTSecretKey)}

	if cfg.ZeroTrustConfig != nil && cfg.ZeroTrustConfig.IsStrictMode() {
		ztMiddleware := middleware.NewZeroTrustMiddleware(cfg.ZeroTrustConfig)
		authMiddleware = append(authMiddleware, ztMiddleware.Handle)
	}

	authProtected := api.Group("/auth", authMiddleware...)
	authProtected.Post("/change-password", cfg.AuthHandler.ChangePassword)
	authProtected.Get("/profile", cfg.UserHandler.GetProfile)
	authProtected.Patch("/profile/avatar", cfg.UserHandler.UpdateAvatar)

	users := api.Group("/users", authMiddleware...)
	users.Get("/students", middleware.RequireInstructor(), cfg.UserHandler.GetStudents)
	users.Get("/", middleware.RequireAdmin(), cfg.UserHandler.GetUsers)
	users.Post("/bulk", cfg.UserHandler.GetUsersByIDs)
	users.Get("/:id", cfg.UserHandler.GetUserByID)
	users.Get("/:id/activity", middleware.RequireAdmin(), cfg.UserHandler.GetUserActivity)
	users.Post("/", middleware.RequireAdmin(), cfg.UserHandler.CreateUser)
	users.Put("/:id", middleware.RequireAdmin(), cfg.UserHandler.UpdateUser)
	users.Delete("/:id", middleware.RequireSuperAdmin(), cfg.UserHandler.DeleteUser)
	users.Post("/:id/restore", middleware.RequireAdmin(), cfg.UserHandler.RestoreUser)

	users.Get("/import/template", middleware.RequireAdmin(), cfg.BulkImportHandler.DownloadTemplate)
	users.Post("/import/preview", middleware.RequireAdmin(), cfg.BulkImportHandler.PreviewImport)
	users.Post("/import/execute", middleware.RequireAdmin(), cfg.BulkImportHandler.ExecuteImport)

	adminProtected := api.Group("", authMiddleware...)
	cfg.AuthHandler.RegisterAdminRoutes(adminProtected)
	adminProtected.Get("/users/:id/activity", cfg.UserHandler.GetUserActivity)

	// RBAC stub routes
	api.Get("/roles", middleware.AuthMiddleware(cfg.JWTSecretKey), cfg.RBACHandler.GetRoles)
	api.Get("/permissions", middleware.AuthMiddleware(cfg.JWTSecretKey), cfg.RBACHandler.GetPermissions)

	app.Get("/", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"service": "iam-service",
			"version": "1.0.0",
			"status":  "running",
		})
	})
}
