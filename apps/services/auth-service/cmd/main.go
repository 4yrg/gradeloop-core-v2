package main

import (
	"log"

	"github.com/4yrg/gradeloop-core-v2/apps/services/auth-service/database"
	"github.com/4yrg/gradeloop-core-v2/apps/services/auth-service/router"

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
	log.Fatal(app.Listen(":3000", fiber.ListenConfig{EnablePrefork: true}))
}
