package main

import (
	"os"

	gl_logger "github.com/4yrg/gradeloop-core-v2/shared/libs/go/logger"
	"github.com/gofiber/fiber/v3"
)

func main() {
	l := gl_logger.New("academics-service")
	l.Info("Starting Academics Service...")

	app := fiber.New()

	app.Get("/api/academics/health", func(c fiber.Ctx) error {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{"status": "ok"})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}

	l.Info("Server starting", "port", port)
	if err := app.Listen(":" + port); err != nil {
		l.Error("Error starting server", "error", err)
		os.Exit(1)
	}
}
