package main

import (
	"context"
	"log"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/logger"
	"github.com/4yrg/gradeloop-core-v2/apps/services/email/internal/config"
	"github.com/4yrg/gradeloop-core-v2/apps/services/email/internal/delivery/http"
	"github.com/4yrg/gradeloop-core-v2/apps/services/email/internal/infrastructure"
	infra "github.com/4yrg/gradeloop-core-v2/apps/services/email/internal/infrastructure/rabbitmq"
	"github.com/4yrg/gradeloop-core-v2/apps/services/email/internal/repository"
	"github.com/4yrg/gradeloop-core-v2/apps/services/email/internal/service"
	"github.com/4yrg/gradeloop-core-v2/apps/services/email/internal/worker"
)

func main() {
	// 1. Load Config
	cfg := config.LoadConfig()

	// 2. Setup Database
	db := infrastructure.NewPostgresDB(cfg)

	// 3. Setup RabbitMQ
	rabbitConn, err := infra.NewConnection(cfg.RabbitMQ.URL)
	if err != nil {
		log.Fatalf("Failed to connect to RabbitMQ: %v", err)
	}
	defer rabbitConn.Close()

	producer := infra.NewProducer(rabbitConn)
	consumer := infra.NewConsumer(rabbitConn)

	// 4. Setup Components
	// Run Seeder
	repository.SeedTemplates(db)
	emailRepo := repository.NewPostgresRepository(db)
	emailService := service.NewEmailService(emailRepo, producer)
	emailHandler := http.NewHandler(emailService)

	// 5. Setup & Start Worker (Consumer)
	mailer := infrastructure.NewMailer(cfg)
	emailWorker := worker.NewConsumer(consumer, emailRepo, mailer, producer)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go emailWorker.Start(ctx)

	// 6. Setup Fiber App
	app := fiber.New()

	// Middleware
	app.Use(logger.New())
	app.Use(cors.New())

	// Routes
	api := app.Group("/api/v1/emails")

	api.Post("/send", emailHandler.SendEmail)
	api.Post("/templates", emailHandler.CreateTemplate)
	api.Get("/templates/:id", emailHandler.GetTemplate)
	api.Get("/status/:id", emailHandler.GetStatus)

	app.Get("/health", func(c fiber.Ctx) error {
		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"status":  "ok",
			"service": "email-service",
		})
	})

	log.Printf("Email Service starting on port %s", cfg.App.Port)
	log.Fatal(app.Listen(":" + cfg.App.Port))
}
