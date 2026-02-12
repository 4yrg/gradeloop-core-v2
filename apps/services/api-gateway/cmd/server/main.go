package main

import (
	"log"
	"log/slog"
	"os"

	"github.com/4yrg/gradeloop-core-v2/apps/services/api-gateway/internal/config"
	"github.com/4yrg/gradeloop-core-v2/apps/services/api-gateway/internal/middleware"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/proxy"
)

func main() {
	// Initialize Logger
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	// Load Config
	cfg, err := config.LoadConfig("config/routes.yaml")
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	app := fiber.New(fiber.Config{
		AppName: "GradeLoop API Gateway",
	})

	// Public Routes (Health, etc.)
	app.Get("/health", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "healthy"})
	})

	// Protected Routes based on config
	jwtMid := middleware.JWTMiddleware(cfg.JWTSecret)

	for _, r := range cfg.Routes {
		permissionMid := middleware.HasPermission(r.Permission, logger)

		// Register route in fiber
		app.Add(r.Method, r.Path, jwtMid, permissionMid, func(c fiber.Ctx) error {
			// Determine upstream based on service prefix or explicit config
			// For Academics Service, all routes in our config are Academics.
			target := cfg.Upstream["academics"] + c.Path()
			return proxy.Do(c, target)
		})
	}

	// Default 404 handler for any other /api routes
	app.Use("/api", func(c fiber.Ctx) error {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "not_found", "message": "Route not registered in gateway"})
	})

	log.Fatal(app.Listen(":8080"))
}
