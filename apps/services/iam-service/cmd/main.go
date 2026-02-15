package main

import (
	"log"
	"os"
	"strconv"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/database"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/router"

	"github.com/gofiber/fiber/v3"
	// "github.com/gofiber/fiber/v3/middleware/cors"
)

func main() {
	app := fiber.New(fiber.Config{
		CaseSensitive: true,
		StrictRouting: true,
		ServerHeader:  "Fiber",
		AppName:       "Auth Service",
	})
	// app.Use(cors.New())

	database.ConnectDB()

	router.SetupRoutes(app)

	// Use SERVER_PORT environment variable if provided, otherwise default to 3000.
	// Validate that the port is numeric and fall back to 3000 on error.
	port := os.Getenv("SERVER_PORT")
	if port == "" {
		port = "8081"
	}
	if _, err := strconv.Atoi(port); err != nil {
		log.Printf("Warning: invalid SERVER_PORT %q, falling back to 3000", port)
		port = "8081"
	}

	// Enable prefork only if explicitly requested via ENABLE_PREFORK=true
	enablePrefork := false
	if ep := os.Getenv("ENABLE_PREFORK"); ep == "true" {
		enablePrefork = true
	}

	addr := ":" + port
	log.Fatal(app.Listen(addr, fiber.ListenConfig{EnablePrefork: enablePrefork}))
}
