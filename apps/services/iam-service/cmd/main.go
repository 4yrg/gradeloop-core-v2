package main

import (
	"context"
	"log"
	"time"

	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/application/usecases"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/http"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/http/handlers"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/repositories"
	"github.com/4YRG/gradeloop-core-v2/shared/libs/go/secrets"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	// Initialize context for startup operations
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Initialize Secrets Client (Vault)
	// NewClient(nil) uses default configuration from environment variables:
	// VAULT_ADDR, VAULT_TOKEN, VAULT_MOUNT_PATH, etc.
	secretsClient, err := secrets.NewClient(nil)
	if err != nil {
		log.Fatalf("failed to initialize secrets client: %v", err)
	}
	defer secretsClient.Close()

	// Retrieve Database Configuration from Vault (path: secret/database/postgres)
	dbConfig, err := secretsClient.GetDatabaseConfig(ctx)
	if err != nil {
		log.Fatalf("failed to retrieve database configuration from vault: %v", err)
	}

	dsn := dbConfig.ConnectionString()

	// Initialize Database Connection using GORM
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}

	// Auto Migration
	if err := db.AutoMigrate(&models.User{}, &models.Student{}, &models.Employee{}); err != nil {
		log.Fatalf("failed to migrate database: %v", err)
	}

	// Dependency Injection
	userRepo := repositories.NewUserRepository(db)
	userUsecase := usecases.NewUserUsecase(userRepo)
	userHandler := handlers.NewUserHandler(userUsecase)

	// Start Server
	http.Start(userHandler)
}
