package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain/models"
	gl_logger "github.com/4yrg/gradeloop-core-v2/shared/libs/go/logger"
	"github.com/4yrg/gradeloop-core-v2/shared/libs/go/secrets"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// SeedOptions contains configuration for seeding
type SeedOptions struct {
	Email    string
	Password string
	FullName string
	Force    bool // Force recreate even if users exist
}

func main() {
	logger := gl_logger.New("iam-seed")
	ctx := context.Background()

	// Parse command line arguments
	opts, err := parseArgs()
	if err != nil {
		logger.Error("Invalid arguments", "error", err)
		printUsage()
		os.Exit(1)
	}

	logger.Info("Starting admin user seeding process...")

	// Initialize database connection
	db, err := initializeDatabase(ctx, logger)
	if err != nil {
		logger.Error("Failed to initialize database", "error", err)
		os.Exit(1)
	}

	// Run migrations first
	if err := runMigrations(db, logger); err != nil {
		logger.Error("Failed to run migrations", "error", err)
		os.Exit(1)
	}

	// Seed permissions and roles
	if err := seedPermissionsAndRoles(db, logger); err != nil {
		logger.Error("Failed to seed permissions and roles", "error", err)
		os.Exit(1)
	}

	// Seed admin user
	if err := seedAdminUser(db, logger, opts); err != nil {
		logger.Error("Failed to seed admin user", "error", err)
		os.Exit(1)
	}

	logger.Info("Admin user seeding completed successfully!")
}

func parseArgs() (*SeedOptions, error) {
	opts := &SeedOptions{
		Email:    getEnvOrDefault("SEED_ADMIN_EMAIL", "admin@gradeloop.com"),
		Password: getEnvOrDefault("SEED_ADMIN_PASSWORD", ""),
		FullName: getEnvOrDefault("SEED_ADMIN_NAME", "Super Admin"),
		Force:    getEnvOrDefault("SEED_FORCE", "false") == "true",
	}

	// Validate required fields
	if opts.Password == "" {
		return nil, errors.New("SEED_ADMIN_PASSWORD environment variable is required")
	}

	if len(opts.Password) < 12 {
		return nil, errors.New("admin password must be at least 12 characters long")
	}

	return opts, nil
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func initializeDatabase(ctx context.Context, logger *slog.Logger) (*gorm.DB, error) {
	logger.Info("Initializing secrets client...")

	// Initialize Secrets Client (Vault)
	secretsClient, err := secrets.NewClient(nil)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize secrets client: %w", err)
	}
	defer secretsClient.Close()

	logger.Info("Retrieving database configuration from Vault...")

	// Retrieve Database Configuration with retry logic
	var dbConfig *secrets.DatabaseConfig
	maxRetries := 10
	for i := 0; i < maxRetries; i++ {
		dbConfig, err = secretsClient.GetDatabaseConfig(ctx)
		if err == nil {
			break
		}
		logger.Info("Waiting for secrets to be available", "attempt", i+1, "max_retries", maxRetries)
		time.Sleep(2 * time.Second)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to retrieve database configuration after retries: %w", err)
	}

	logger.Info("Connecting to database...")
	dsn := dbConfig.ConnectionString()

	// Initialize Database Connection
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		DisableForeignKeyConstraintWhenMigrating: false,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	return db, nil
}

func runMigrations(db *gorm.DB, logger *slog.Logger) error {
	logger.Info("Running database migrations...")

	// Pre-migration cleanup for dev environments
	db.Exec("DELETE FROM permissions WHERE name = '' OR name IS NULL")
	db.Exec("DELETE FROM roles WHERE role_name = '' OR role_name IS NULL")

	// Auto Migration
	err := db.AutoMigrate(
		&models.User{},
		&models.Student{},
		&models.Employee{},
		&models.Role{},
		&models.Permission{},
		&models.AuditLog{},
		&models.RefreshToken{},
		&models.PasswordResetToken{},
	)
	if err != nil {
		return fmt.Errorf("failed to migrate database: %w", err)
	}

	logger.Info("Database migrations completed successfully")
	return nil
}

func seedPermissionsAndRoles(db *gorm.DB, logger *slog.Logger) error {
	logger.Info("Seeding permissions and roles...")

	// Seed initial permissions
	initialPermissions := []models.Permission{
		{Name: "iam:users:create", Description: "Create users", Category: "IAM", IsCustom: false},
		{Name: "iam:users:read", Description: "Read users", Category: "IAM", IsCustom: false},
		{Name: "iam:users:update", Description: "Update users", Category: "IAM", IsCustom: false},
		{Name: "iam:users:delete", Description: "Delete users", Category: "IAM", IsCustom: false},
		{Name: "iam:roles:manage", Description: "Manage roles and permissions", Category: "IAM", IsCustom: false},
		{Name: "academics:courses:create", Description: "Create courses", Category: "Academics", IsCustom: false},
		{Name: "academics:courses:read", Description: "Read courses", Category: "Academics", IsCustom: false},
		{Name: "academics:courses:update", Description: "Update courses", Category: "Academics", IsCustom: false},
		{Name: "academics:courses:delete", Description: "Delete courses", Category: "Academics", IsCustom: false},
		{Name: "academics:assignments:create", Description: "Create assignments", Category: "Academics", IsCustom: false},
		{Name: "academics:assignments:read", Description: "Read assignments", Category: "Academics", IsCustom: false},
		{Name: "academics:assignments:update", Description: "Update assignments", Category: "Academics", IsCustom: false},
		{Name: "academics:assignments:delete", Description: "Delete assignments", Category: "Academics", IsCustom: false},
		{Name: "academics:assignments:grade", Description: "Grade assignments", Category: "Academics", IsCustom: false},
		{Name: "analytics:reports:view", Description: "View analytics reports", Category: "Analytics", IsCustom: false},
		{Name: "system:admin", Description: "Full system administration", Category: "System", IsCustom: false},
	}

	for _, p := range initialPermissions {
		if err := db.Where(models.Permission{Name: p.Name}).FirstOrCreate(&p).Error; err != nil {
			logger.Warn("Failed to seed permission", "permission", p.Name, "error", err)
		}
	}

	// Seed reserved roles
	for roleName := range models.ReservedRoles {
		role := models.Role{RoleName: roleName, IsCustom: false}
		if err := db.Where(models.Role{RoleName: roleName}).FirstOrCreate(&role).Error; err != nil {
			logger.Warn("Failed to seed reserved role", "role", roleName, "error", err)
		}
	}

	// Assign all permissions to admin role
	var adminRole models.Role
	if err := db.Where("role_name = ?", models.RoleAdmin).First(&adminRole).Error; err != nil {
		return fmt.Errorf("failed to find admin role: %w", err)
	}

	var allPermissions []models.Permission
	if err := db.Find(&allPermissions).Error; err != nil {
		return fmt.Errorf("failed to fetch permissions: %w", err)
	}

	// Associate all permissions with admin role
	if err := db.Model(&adminRole).Association("Permissions").Replace(allPermissions); err != nil {
		return fmt.Errorf("failed to assign permissions to admin role: %w", err)
	}

	logger.Info("Permissions and roles seeded successfully", "permissions_count", len(initialPermissions))
	return nil
}

func seedAdminUser(db *gorm.DB, logger *slog.Logger, opts *SeedOptions) error {
	logger.Info("Seeding admin user...", "email", opts.Email)

	// Check if users already exist
	var userCount int64
	if err := db.Model(&models.User{}).Count(&userCount).Error; err != nil {
		return fmt.Errorf("failed to count existing users: %w", err)
	}

	if userCount > 0 && !opts.Force {
		logger.Info("Users already exist in database. Use SEED_FORCE=true to recreate admin user")
		return nil
	}

	// If force is enabled, remove existing admin user
	if opts.Force {
		logger.Info("Force mode enabled, removing existing admin user if present...")
		db.Where("email = ?", opts.Email).Delete(&models.User{})
	}

	// Hash the password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(opts.Password), 12)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// Find the admin role
	var adminRole models.Role
	if err := db.Where("role_name = ?", models.RoleAdmin).First(&adminRole).Error; err != nil {
		return fmt.Errorf("failed to find admin role: %w", err)
	}

	// Create admin user
	now := time.Now()
	adminUser := &models.User{
		ID:                      uuid.New(),
		Email:                   opts.Email,
		FullName:                opts.FullName,
		PasswordHash:            string(hashedPassword),
		UserType:                models.UserTypeEmployee,
		IsActive:                true,
		IsPasswordResetRequired: false,
		PasswordSetAt:           &now,
		PasswordChangedAt:       &now,
		CreatedAt:               now,
		UpdatedAt:               now,
	}

	// Create user with transaction
	err = db.Transaction(func(tx *gorm.DB) error {
		// Create the user
		if err := tx.Create(adminUser).Error; err != nil {
			return fmt.Errorf("failed to create admin user: %w", err)
		}

		// Create employee profile
		employee := &models.Employee{
			ID:           adminUser.ID,
			EmployeeID:   "ADMIN-001",
			Designation:  "System Administrator",
			EmployeeType: "Administrator",
		}

		if err := tx.Create(employee).Error; err != nil {
			return fmt.Errorf("failed to create employee profile: %w", err)
		}

		// Assign admin role
		if err := tx.Model(adminUser).Association("Roles").Append(&adminRole); err != nil {
			return fmt.Errorf("failed to assign admin role: %w", err)
		}

		return nil
	})

	if err != nil {
		return err
	}

	logger.Info("Admin user created successfully",
		"user_id", adminUser.ID,
		"email", adminUser.Email,
		"full_name", adminUser.FullName,
	)

	return nil
}

func printUsage() {
	fmt.Println("Usage: go run seed_admin.go")
	fmt.Println("\nEnvironment Variables:")
	fmt.Println("  SEED_ADMIN_EMAIL     Admin email address (default: admin@gradeloop.com)")
	fmt.Println("  SEED_ADMIN_PASSWORD  Admin password (required, min 12 characters)")
	fmt.Println("  SEED_ADMIN_NAME      Admin full name (default: Super Admin)")
	fmt.Println("  SEED_FORCE           Force recreate admin user (default: false)")
	fmt.Println("\nVault Configuration:")
	fmt.Println("  VAULT_ADDR           Vault server address")
	fmt.Println("  VAULT_TOKEN          Vault authentication token")
	fmt.Println("\nDatabase Configuration (via Vault):")
	fmt.Println("  The script retrieves database connection details from Vault")
	fmt.Println("\nExample:")
	fmt.Println("  SEED_ADMIN_PASSWORD=MySecurePassword123 go run scripts/seed_admin.go")
}
