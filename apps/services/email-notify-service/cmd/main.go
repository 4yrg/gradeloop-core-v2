package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"email-notify-service/internal/core/domain"
	"email-notify-service/internal/core/services"
	"email-notify-service/internal/handlers/event"
	httphandler "email-notify-service/internal/handlers/http"
	"email-notify-service/internal/repositories"
	"email-notify-service/internal/server"
)

func main() {
	log.Println("[Main] Email Notify Service is starting...")

	// Load configuration (in production, use a proper config library)
	config := loadConfig()

	// Initialize repositories
	vaultRepo, err := repositories.NewVaultRepository(
		config.Vault.Address,
		config.Vault.Token,
		config.Vault.Namespace,
		config.Vault.MountPath,
		config.SMTP.SecretPath,
	)
	if err != nil {
		log.Fatalf("[Main] Failed to initialize Vault repository: %v", err)
	}
	defer vaultRepo.Close()

	// Get SMTP configuration from Vault
	ctx := context.Background()
	smtpConfig, err := vaultRepo.GetSMTPConfig(ctx)
	if err != nil {
		log.Fatalf("[Main] Failed to get SMTP configuration: %v", err)
	}
	log.Printf("[Main] SMTP configuration loaded for host: %s", smtpConfig.Host)

	// Initialize SMTP repository
	smtpRepo := repositories.NewSmtpRepository(*smtpConfig)

	// Initialize RabbitMQ repository
	rabbitmqRepo, err := repositories.NewRabbitMQRepository(config.RabbitMQ.URL)
	if err != nil {
		log.Fatalf("[Main] Failed to initialize RabbitMQ repository: %v", err)
	}
	defer rabbitmqRepo.Close()

	// Setup RabbitMQ exchange and queue
	err = rabbitmqRepo.SetupEmailQueue(config.RabbitMQ.Exchange, config.RabbitMQ.Queue)
	if err != nil {
		log.Fatalf("[Main] Failed to setup RabbitMQ queue: %v", err)
	}

	// Initialize services
	emailService := services.NewEmailService(smtpRepo)

	// Initialize handlers
	httpHandler := httphandler.NewEmailHandler(emailService)
	eventHandler := event.NewEventHandler(emailService)

	// Initialize server
	srv := server.NewServer(config, httpHandler)

	// Create context for graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Start services
	var wg sync.WaitGroup

	// Start HTTP server
	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := srv.Start(); err != nil {
			log.Printf("[Main] HTTP server error: %v", err)
		}
	}()

	// Start RabbitMQ consumer
	wg.Add(1)
	go func() {
		defer wg.Done()
		log.Printf("[Main] Starting RabbitMQ consumer for queue: %s", config.RabbitMQ.Queue)

		messageHandler := eventHandler.CreateMessageHandler(ctx)
		if err := rabbitmqRepo.Consume(ctx, config.RabbitMQ.Queue, messageHandler); err != nil {
			log.Printf("[Main] RabbitMQ consumer error: %v", err)
		}
	}()

	log.Println("[Main] Email Notify Service started successfully")

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("[Main] Shutting down Email Notify Service...")

	// Cancel context to stop consumers
	cancel()

	// Shutdown HTTP server
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("[Main] HTTP server shutdown error: %v", err)
	}

	// Wait for all goroutines to finish
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		log.Println("[Main] Email Notify Service stopped gracefully")
	case <-time.After(10 * time.Second):
		log.Println("[Main] Forced shutdown after timeout")
	}
}

func loadConfig() *domain.Config {
	config := &domain.Config{}

	// Set defaults
	config.Server.Host = getEnv("SERVER_HOST", "localhost")
	config.Server.Port = getEnvAsInt("SERVER_PORT", 8080)

	config.RabbitMQ.URL = getEnv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/")
	config.RabbitMQ.Exchange = getEnv("RABBITMQ_EXCHANGE", "gradeloop.events")
	config.RabbitMQ.Queue = getEnv("RABBITMQ_QUEUE", "email.notifications")

	config.Vault.Address = getEnv("VAULT_ADDR", "http://localhost:8200")
	config.Vault.Token = getEnv("VAULT_TOKEN", "dev-root-token")
	config.Vault.Namespace = getEnv("VAULT_NAMESPACE", "")
	config.Vault.MountPath = getEnv("VAULT_MOUNT_PATH", "secret")

	config.SMTP.SecretPath = getEnv("SMTP_SECRET_PATH", "secret/data/smtp")

	return config
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	// Simple implementation - in production, use proper parsing
	if value := os.Getenv(key); value != "" {
		// Add proper parsing logic here
	}
	return defaultValue
}
