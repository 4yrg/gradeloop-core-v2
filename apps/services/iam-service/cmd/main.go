package main

import (
	"log"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/config"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/handler"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/middleware"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/rbac"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/repository"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/router"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/service"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
)

func main() {
	// Initialize Fiber app
	app := fiber.New(fiber.Config{
		AppName:      "IAM Service",
		ErrorHandler: handler.ErrorHandler,
	})

	app.Use(cors.New())

	// Database Connection
	postgresRepo, err := repository.NewPostgresRepository()
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Auto Migration & Seeding
	if err := postgresRepo.AutoMigrate(); err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	// Repositories
	userRepo := repository.NewUserRepository(postgresRepo.DB)
	roleRepo := repository.NewRoleRepository(postgresRepo.DB)
	permRepo := repository.NewPermissionRepository(postgresRepo.DB)
	auditRepo := repository.NewAuditRepository(postgresRepo.DB)
	tokenRepo := repository.NewRefreshTokenRepository(postgresRepo.DB)
	passwordResetRepo := repository.NewPasswordResetRepository(postgresRepo.DB)

	// Services
	userService := service.NewUserService(userRepo, roleRepo, auditRepo)
	roleService := service.NewRoleService(roleRepo, permRepo, auditRepo)
	authService := service.NewAuthService(userRepo, tokenRepo, passwordResetRepo, auditRepo)
	auditService := service.NewAuditService(auditRepo)

	// RBAC Manager
	rbacManager := rbac.NewRBACManager(roleRepo, permRepo)

	// Handlers
	userHandler := handler.NewUserHandler(userService)
	roleHandler := handler.NewRoleHandler(roleService)
	authHandler := handler.NewAuthHandler(authService)
	auditHandler := handler.NewAuditHandler(auditService)

	// Middleware
	rbacMiddleware := middleware.NewRBACMiddleware(rbacManager)

	// Setup Routes
	routerConfig := router.Config{
		UserHandler:  userHandler,
		AuthHandler:  authHandler,
		RoleHandler:  roleHandler,
		AuditHandler: auditHandler,
		RBAC:         rbacMiddleware,
	}
	router.SetupRoutes(app, routerConfig)

	// Start Server
	port := config.Config("SERVER_PORT") // Use existing config helper or os.Getenv
	if port == "" {
		port = "8081" // Default for IAM service
	}

	log.Printf("Starting server on port %s", port)
	log.Fatal(app.Listen(":" + port))
}
