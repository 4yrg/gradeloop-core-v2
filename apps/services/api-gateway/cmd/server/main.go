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
		// Handle public routes (permission: "public")
		if r.Permission == "public" {
			// Register route without JWT middleware
			app.Add([]string{r.Method}, r.Path, func(c fiber.Ctx) error {
				// Determine upstream based on service configuration
				upstreamURL, ok := cfg.Upstream[r.Service]
				if !ok {
					logger.Error("upstream not found for service", "service", r.Service)
					return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": "upstream_configuration_error"})
				}

				// Forward to upstream service
				target := upstreamURL + c.Path()
				return proxy.Do(c, target)
			})
			continue
		}

		// Handle protected routes
		permissionMid := middleware.HasPermission(r.Permission, logger)

		// Register route in fiber
		app.Add([]string{r.Method}, r.Path, jwtMid, permissionMid, func(c fiber.Ctx) error {
			// Determine upstream based on service configuration
			upstreamURL, ok := cfg.Upstream[r.Service]
			if !ok {
				logger.Error("upstream not found for service", "service", r.Service)
				return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": "upstream_configuration_error"})
			}

			// Remove the service prefix if needed, or just forward as is.
			// Assuming services expect the full path /api/...
			target := upstreamURL + c.Path()
			return proxy.Do(c, target)
		})
	}

	// Default 404 handler for any other /api routes
	app.Use("/api", func(c fiber.Ctx) error {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "not_found", "message": "Route not registered in gateway"})
	})

	log.Fatal(app.Listen(":8080"))
}
