package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/notification/internal/config"
	"github.com/4yrg/gradeloop-core-v2/apps/services/notification/internal/handler"
	"github.com/4yrg/gradeloop-core-v2/apps/services/notification/internal/middleware"
	"github.com/4yrg/gradeloop-core-v2/apps/services/notification/internal/queue"
	redispubsub "github.com/4yrg/gradeloop-core-v2/apps/services/notification/internal/redis"
	"github.com/4yrg/gradeloop-core-v2/apps/services/notification/internal/repository"
	"github.com/4yrg/gradeloop-core-v2/apps/services/notification/internal/repository/migrations"
	"github.com/4yrg/gradeloop-core-v2/apps/services/notification/internal/router"
	"github.com/4yrg/gradeloop-core-v2/apps/services/notification/internal/service"
	"github.com/4yrg/gradeloop-core-v2/apps/services/notification/internal/sse"
	"github.com/4yrg/gradeloop-core-v2/apps/services/notification/internal/utils"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"go.uber.org/zap"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "error starting notification-service: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("loading config: %w", err)
	}

	if err := utils.InitLogger(); err != nil {
		return fmt.Errorf("initialising logger: %w", err)
	}
	defer utils.Sync()

	logger := utils.GetLogger()

	db, err := repository.NewPostgresDatabase(cfg, logger)
	if err != nil {
		return fmt.Errorf("connecting to database: %w", err)
	}
	defer db.Close()

	migrator := migrations.NewMigrator(db.DB, logger)
	if err := migrator.Run(); err != nil {
		return fmt.Errorf("running migrations: %w", err)
	}

	rmq, err := queue.NewRabbitMQ(cfg.RabbitMQ.URL, logger)
	if err != nil {
		return fmt.Errorf("connecting to rabbitmq: %w", err)
	}
	defer rmq.Close()

	go rmq.WatchReconnect()
	logger.Info("connected to rabbitmq", zap.String("url", cfg.RabbitMQ.URL))

	ps, err := redispubsub.NewPubSub(cfg.Redis.URL, logger)
	if err != nil {
		return fmt.Errorf("connecting to redis: %w", err)
	}
	defer ps.Close()

	notificationRepo := repository.NewNotificationRepository(db.DB)
	hub := sse.NewHub(logger)
	go hub.Run()

	notificationService := service.NewNotificationService(notificationRepo, hub, ps, logger)

	consumer := queue.NewNotificationConsumer(rmq, notificationService.ProcessIncoming, logger)

	healthHandler := handler.NewHealthHandler()
	notificationHandler := handler.NewNotificationHandler(notificationService, logger)
	sseHandler := handler.NewSSEHandler(hub, logger)

	app := fiber.New(fiber.Config{
		AppName:      "notification-service",
		ErrorHandler: utils.ErrorHandler,
	})

	app.Use(middleware.Recovery())
	app.Use(middleware.Logger())
	app.Use(cors.New(cors.Config{
		AllowOrigins:     []string{cfg.FrontendURL, "http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Request-ID"},
		AllowCredentials: true,
	}))

	router.SetupRoutes(app, router.Config{
		HealthHandler:       healthHandler,
		NotificationHandler: notificationHandler,
		SSEHandler:          sseHandler,
		JWTSecretKey:        []byte(cfg.JWT.SecretKey),
	})

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	consumerCtx, cancelConsumer := context.WithCancel(context.Background())
	defer cancelConsumer()

	go consumer.Start(consumerCtx)

	logger.Info("notification consumer started")

	go func() {
		addr := fmt.Sprintf(":%s", cfg.Server.Port)
		logger.Info("starting server", zap.String("address", addr))
		if err := app.Listen(addr); err != nil {
			logger.Error("server listen error", zap.Error(err))
		}
	}()

	<-sigChan
	logger.Info("shutdown signal received, stopping server...")

	httpCtx, httpCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer httpCancel()

	if err := app.ShutdownWithContext(httpCtx); err != nil {
		logger.Error("server shutdown error", zap.Error(err))
		return fmt.Errorf("shutting down server: %w", err)
	}

	cancelConsumer()
	logger.Info("waiting for notification consumer to drain...")
	time.Sleep(2 * time.Second)

	logger.Info("server stopped gracefully")
	return nil
}