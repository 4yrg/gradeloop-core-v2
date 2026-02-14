package app

import (
	"context"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/logger"
	"github.com/gofiber/fiber/v3/middleware/recover"
	"github.com/rs/zerolog/log"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/config"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/handlers"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/middleware"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/services"

	"gorm.io/gorm"
)

// App represents the main application
type App struct {
	Fiber *fiber.App
	DB    *gorm.DB
	Cfg   *config.Config
}

// New creates a new application instance
func New(cfg *config.Config) (*App, error) {
	// Connect to database
	db, err := config.ConnectDB(cfg)
	if err != nil {
		return nil, err
	}

	// Skip auto-migration for now to avoid constraint conflicts
	// TODO: Implement proper migration strategy
	log.Info().Msg("Skipping auto-migration, using existing database schema")
	
	// Initialize Fiber app
	app := fiber.New(fiber.Config{
		ErrorHandler: CustomErrorHandler,
	})

	// Register middleware
	registerMiddleware(app)

	// Create services
	userService := services.NewUserService(db)
	authService := services.NewAuthService(db, cfg.JWTSecret)
	roleService := services.NewRoleService(db)
	permissionService := services.NewPermissionService(db)

	// Create handlers
	authHandler := handlers.NewAuthHandler(authService, userService)
	userHandler := handlers.NewUserHandler(userService)
	roleHandler := handlers.NewRoleHandler(roleService)
	permissionHandler := handlers.NewPermissionHandler(permissionService)

	// Register routes
	registerRoutes(app, db, cfg, authHandler, userHandler, roleHandler, permissionHandler)

	// Create initial admin if none exists
	initialAdminEmail := os.Getenv("INITIAL_ADMIN_EMAIL")
	initialAdminPassword := os.Getenv("INITIAL_ADMIN_PASSWORD")
	if initialAdminEmail != "" && initialAdminPassword != "" {
		if err := authService.CreateInitialAdmin(initialAdminEmail, initialAdminPassword); err != nil {
			if err.Error() != "users already exist, cannot create initial admin" {
				log.Error().Err(err).Msg("Failed to create initial admin")
			} else {
				log.Info().Msg("Initial admin already exists, skipping creation")
			}
		} else {
			log.Info().Msg("Initial admin created successfully")
		}
	}

	return &App{
		Fiber: app,
		DB:    db,
		Cfg:   cfg,
	}, nil
}

// registerMiddleware registers application middleware
func registerMiddleware(app *fiber.App) {
	app.Use(recover.New())
	app.Use(logger.New())

	allowedOrigins := getEnvOrDefault("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173")
	origins := strings.Split(allowedOrigins, ",")

	app.Use(cors.New(cors.Config{
		AllowOrigins: origins,
		AllowMethods: []string{"GET", "POST", "HEAD", "PUT", "DELETE", "PATCH", "OPTIONS"},
		AllowHeaders: []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Requested-With"},
	}))
}

// registerRoutes registers application routes
func registerRoutes(app *fiber.App, db *gorm.DB, cfg *config.Config, authHandler *handlers.AuthHandler, userHandler *handlers.UserHandler, roleHandler *handlers.RoleHandler, permissionHandler *handlers.PermissionHandler) {
	// Health check endpoint
	app.Get("/health", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":    "ok",
			"timestamp": time.Now().Unix(),
		})
	})

	// Authentication routes
	auth := app.Group("/auth")
	auth.Post("/login", authHandler.Login)
	auth.Post("/refresh", authHandler.Refresh)
	auth.Post("/activate", authHandler.Activate)
	auth.Post("/forgot-password", authHandler.ForgotPassword)
	auth.Post("/reset-password", authHandler.ResetPassword)
	auth.Post("/logout", authHandler.Logout)

	// Protected routes
	protected := app.Group("/api/v1", middleware.AuthMiddleware(cfg.JWTSecret))
	protected.Get("/me", authHandler.Me)

	// User management routes (admin only)
	users := protected.Group("/users")
	users.Post("/", middleware.HasRole("admin"), userHandler.CreateUser)
	users.Get("/", middleware.HasRole("admin"), userHandler.ListUsers)
	users.Get("/:id", middleware.HasRole("admin"), userHandler.GetUserByID)
	users.Put("/:id", middleware.HasRole("admin"), userHandler.UpdateUser)
	users.Delete("/:id", middleware.HasRole("admin"), userHandler.DeleteUser)
	users.Patch("/:id/restore", middleware.HasRole("admin"), userHandler.RestoreUser)

	// Role management routes (admin only)
	roles := protected.Group("/roles")
	roles.Post("/", middleware.HasRole("admin"), roleHandler.CreateRole)
	roles.Get("/", middleware.HasRole("admin"), roleHandler.ListRoles)
	roles.Get("/:id", middleware.HasRole("admin"), roleHandler.GetRoleByID)
	roles.Post("/:roleId/permissions/:permissionId", middleware.HasRole("admin"), roleHandler.AddPermissionToRole)
	roles.Delete("/:roleId/permissions/:permissionId", middleware.HasRole("admin"), roleHandler.RemovePermissionFromRole)

	// Permission management routes (admin only)
	permissions := protected.Group("/permissions")
	permissions.Post("/", middleware.HasRole("admin"), permissionHandler.CreatePermission)
	permissions.Get("/", middleware.HasRole("admin"), permissionHandler.ListPermissions)
	permissions.Get("/:id", middleware.HasRole("admin"), permissionHandler.GetPermissionByID)
}

// CustomErrorHandler handles errors in a custom way
func CustomErrorHandler(c fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
	}

	log.Error().Err(err).Int("status_code", code).Str("path", c.Path()).Msg("Request error")

	return c.Status(code).JSON(fiber.Map{
		"error": map[string]interface{}{
			"message": err.Error(),
			"status":  code,
		},
	})
}

// getEnvOrDefault retrieves environment variable or returns a default value
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// Start starts the application server
func (a *App) Start(port string) error {
	// Start server in a goroutine
	go func() {
		if err := a.Fiber.Listen(":" + port); err != nil {
			log.Error().Err(err).Msg("Server failed to start")
		}
	}()

	log.Info().Msgf("Server is running on port %s", port)

	// Wait for interrupt signal to gracefully shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("Shutting down server...")

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := a.Fiber.ShutdownWithContext(ctx); err != nil {
		log.Error().Err(err).Msg("Server forced to shutdown")
		return err
	}

	log.Info().Msg("Server exited")

	return nil
}
