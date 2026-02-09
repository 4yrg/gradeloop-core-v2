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
	log.Println("Starting IAM Service...")

	// Initialize context for startup operations
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	log.Println("Initializing secrets client...")
	// Initialize Secrets Client (Vault)
	// NewClient(nil) uses default configuration from environment variables:
	// VAULT_ADDR, VAULT_TOKEN, VAULT_MOUNT_PATH, etc.
	secretsClient, err := secrets.NewClient(nil)
	if err != nil {
		log.Fatalf("failed to initialize secrets client: %v", err)
	}
	defer secretsClient.Close()

	log.Println("Retrieving database configuration from Vault...")
	// Retrieve Database Configuration from Vault with retry logic
	var dbConfig *secrets.DatabaseConfig
	maxRetries := 10
	for i := 0; i < maxRetries; i++ {
		dbConfig, err = secretsClient.GetDatabaseConfig(ctx)
		if err == nil {
			break
		}
		log.Printf("Waiting for secrets to be seeded (attempt %d/%d)...", i+1, maxRetries)
		time.Sleep(2 * time.Second)
	}

	if err != nil {
		log.Fatalf("failed to retrieve database configuration from vault after retries: %v", err)
	}

	log.Println("Database configuration retrieved successfully")
	dsn := dbConfig.ConnectionString()

	log.Println("Connecting to database...")
	// Initialize Database Connection using GORM
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}

	log.Println("Connected to database. Running auto-migrations...")
	// Auto Migration
	if err := db.AutoMigrate(&models.User{}, &models.Student{}, &models.Employee{}, &models.Role{}, &models.Permission{}, &models.AuditLog{}); err != nil {
		log.Fatalf("failed to migrate database: %v", err)
	}

	log.Println("Auto-migrations completed. Seeding initial data...")
	// Seed Permissions
	initialPermissions := []models.Permission{
		{Code: "users.create", Description: "Create users"},
		{Code: "users.read", Description: "Read users"},
		{Code: "users.update", Description: "Update users"},
		{Code: "users.delete", Description: "Delete users"},
		{Code: "roles.manage", Description: "Manage roles and permissions"},
	}

	for _, p := range initialPermissions {
		if err := db.Where(models.Permission{Code: p.Code}).FirstOrCreate(&p).Error; err != nil {
			log.Printf("failed to seed permission %s: %v", p.Code, err)
		}
	}

	// Seed Reserved Roles
	for roleName := range models.ReservedRoles {
		role := models.Role{RoleName: roleName, IsCustom: false}
		if err := db.Where(models.Role{RoleName: roleName}).FirstOrCreate(&role).Error; err != nil {
			log.Printf("failed to seed reserved role %s: %v", roleName, err)
		}
	}

	log.Println("Seeding completed. Initializing dependencies...")
	// Dependency Injection
	userRepo := repositories.NewUserRepository(db)
	userUsecase := usecases.NewUserUsecase(userRepo)
	userHandler := handlers.NewUserHandler(userUsecase)

	auditRepo := repositories.NewAuditRepository(db)
	roleRepo := repositories.NewRoleRepository(db)
	roleUsecase := usecases.NewRoleUsecase(roleRepo, auditRepo)
	roleHandler := handlers.NewRoleHandler(roleUsecase)

	// Start Server
	http.Start(userHandler, roleHandler)
}
