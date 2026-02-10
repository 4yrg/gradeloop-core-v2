package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/google/uuid"

	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/application/usecases"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/http"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/http/handlers"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/notifications"
	"github.com/4YRG/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/repositories"
	gl_logger "github.com/4YRG/gradeloop-core-v2/shared/libs/go/logger"
	"github.com/4YRG/gradeloop-core-v2/shared/libs/go/secrets"
	"github.com/go-redis/redis/v8"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	l := gl_logger.New("iam-service")
	// Use a fixed startup trace ID to ensure all startup logs share the same context
	startupTraceID := "startup-" + uuid.New().String()
	ctx := context.WithValue(context.Background(), gl_logger.TraceIDKey, startupTraceID)

	l.Info("Starting IAM Service...")

	// Initialize context for startup operations
	startupCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	l.Info("Initializing secrets client...")
	// Initialize Secrets Client (Vault)
	// NewClient(nil) uses default configuration from environment variables:
	// VAULT_ADDR, VAULT_TOKEN, VAULT_MOUNT_PATH, etc.
	secretsClient, err := secrets.NewClient(nil)
	if err != nil {
		l.Error("failed to initialize secrets client", "error", err)
		os.Exit(1)
	}
	defer secretsClient.Close()

	l.Info("Retrieving database configuration from Vault...")
	// Retrieve Database Configuration from Vault with retry logic
	var dbConfig *secrets.DatabaseConfig
	maxRetries := 10
	for i := 0; i < maxRetries; i++ {
		dbConfig, err = secretsClient.GetDatabaseConfig(startupCtx)
		if err == nil {
			break
		}
		l.Info("Waiting for secrets to be seeded", "attempt", i+1, "max_retries", maxRetries)
		time.Sleep(2 * time.Second)
	}

	if err != nil {
		l.Error("failed to retrieve database configuration from vault after retries", "error", err)
		os.Exit(1)
	}

	l.Info("Retrieving JWT configuration from Vault...")
	jwtConfig, err := secretsClient.GetJWTConfig(startupCtx)
	if err != nil {
		l.Error("failed to retrieve JWT configuration", "error", err)
		os.Exit(1)
	}

	l.Info("Database configuration retrieved successfully")
	dsn := dbConfig.ConnectionString()

	l.Info("Connecting to database...")
	// Initialize Database Connection using GORM
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		l.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}

	l.Info("Connected to database. Running auto-migrations...")

	// Pre-migration cleanup for dev environments (handles corrupted unique index data)
	// This removes rows with empty or null names that block unique index creation during development
	db.Exec("DELETE FROM permissions WHERE name = '' OR name IS NULL")
	db.Exec("DELETE FROM roles WHERE role_name = '' OR role_name IS NULL")

	// Auto Migration
	if err := db.AutoMigrate(&models.User{}, &models.Student{}, &models.Employee{}, &models.Role{}, &models.Permission{}, &models.AuditLog{}, &models.RefreshToken{}); err != nil {
		l.Error("failed to migrate database", "error", err)
		os.Exit(1)
	}

	l.Info("Auto-migrations completed. Seeding initial data...")
	// Seed Permissions
	initialPermissions := []models.Permission{
		{Name: "iam:users:create", Description: "Create users", Category: "IAM", IsCustom: false},
		{Name: "iam:users:read", Description: "Read users", Category: "IAM", IsCustom: false},
		{Name: "iam:users:update", Description: "Update users", Category: "IAM", IsCustom: false},
		{Name: "iam:users:delete", Description: "Delete users", Category: "IAM", IsCustom: false},
		{Name: "iam:roles:manage", Description: "Manage roles and permissions", Category: "IAM", IsCustom: false},
		{Name: "academics:courses:read", Description: "Read courses", Category: "Academics", IsCustom: false},
	}

	for _, p := range initialPermissions {
		if err := db.Where(models.Permission{Name: p.Name}).FirstOrCreate(&p).Error; err != nil {
			l.Warn("failed to seed permission", "permission", p.Name, "error", err)
		}
	}

	// Seed Reserved Roles
	for roleName := range models.ReservedRoles {
		role := models.Role{RoleName: roleName, IsCustom: false}
		if err := db.Where(models.Role{RoleName: roleName}).FirstOrCreate(&role).Error; err != nil {
			l.Warn("failed to seed reserved role", "role", roleName, "error", err)
		}
	}

	l.Info("Seeding completed. Bootstrapping Super Admin...")
	if err := bootstrapSuperAdmin(db, l); err != nil {
		l.Error("failed to bootstrap super admin", "error", err)
		os.Exit(1)
	}

	l.Info("Bootstrapping completed. Initializing dependencies...")
	// Dependency Injection
	auditRepo := repositories.NewAuditRepository(db)
	userRepo := repositories.NewUserRepository(db)
	roleRepo := repositories.NewRoleRepository(db)
	permissionRepo := repositories.NewPermissionRepository(db)
	refreshTokenRepo := repositories.NewRefreshTokenRepository(db)
	notificationStub := notifications.NewNotificationStub()

	userUsecase := usecases.NewUserUsecase(userRepo, auditRepo)
	roleUsecase := usecases.NewRoleUsecase(roleRepo, auditRepo)
	permissionUsecase := usecases.NewPermissionUsecase(permissionRepo)
	authUsecase := usecases.NewAuthUsecase(userRepo, refreshTokenRepo, auditRepo, notificationStub, jwtConfig.Secret)

	userHandler := handlers.NewUserHandler(userUsecase)
	roleHandler := handlers.NewRoleHandler(roleUsecase)
	permissionHandler := handlers.NewPermissionHandler(permissionUsecase)
	authHandler := handlers.NewAuthHandler(authUsecase)

	// Start Server
	redisAddr := os.Getenv("REDIS_ADDR")
	if redisAddr == "" {
		redisAddr = "localhost:6379"
	}
	redisClient := redis.NewClient(&redis.Options{
		Addr: redisAddr,
	})
	http.Start(userHandler, roleHandler, permissionHandler, authHandler, redisClient, auditRepo)
}

func bootstrapSuperAdmin(db *gorm.DB, l *slog.Logger) error {
	var count int64
	if err := db.Model(&models.User{}).Count(&count).Error; err != nil {
		return err
	}

	if count > 0 {
		l.Info("User table not empty, skipping bootstrapping")
		return nil
	}

	username := os.Getenv("INITIAL_ADMIN_USERNAME")
	password := os.Getenv("INITIAL_ADMIN_PASSWORD")

	if username == "" || password == "" {
		return errors.New("INITIAL_ADMIN_USERNAME and INITIAL_ADMIN_PASSWORD must be set")
	}

	if len(password) < 12 {
		return errors.New("initial admin password must be at least 12 characters long")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return err
	}

	// Find the Admin role
	var adminRole models.Role
	if err := db.Where("role_name = ?", models.RoleAdmin).First(&adminRole).Error; err != nil {
		return fmt.Errorf("failed to find admin role: %w", err)
	}

	adminUser := &models.User{
		Email:         username,
		FullName:      "Super Admin",
		PasswordHash:  string(hash),
		UserType:      models.UserTypeEmployee,
		Roles:         []models.Role{adminRole},
		IsActive:      true,
		PasswordSetAt: func() *time.Time { t := time.Now(); return &t }(),
	}

	if err := db.Create(adminUser).Error; err != nil {
		return err
	}

	l.Info("Super Admin account created", "username", username)
	return nil
}
