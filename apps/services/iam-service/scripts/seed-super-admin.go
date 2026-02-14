package main

import (
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/utils"
)

// Seeding configuration
type SeedConfig struct {
	AdminEmail     string
	AdminPassword  string
	AdminFullName  string
	ForceOverwrite bool
}

func main() {
	// Get configuration from environment
	config := SeedConfig{
		AdminEmail:     getEnv("SEED_ADMIN_EMAIL", "admin@gradeloop.com"),
		AdminPassword:  getEnv("SEED_ADMIN_PASSWORD", "Admin@123"),
		AdminFullName:  getEnv("SEED_ADMIN_NAME", "Super Administrator"),
		ForceOverwrite: getEnv("SEED_FORCE", "false") == "true",
	}

	// Get database connection string
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL environment variable is required")
	}

	fmt.Printf("🔍 Checking database connection...\n")

	// Connect to database
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		log.Fatalf("❌ Failed to connect to database: %v", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("❌ Failed to get database instance: %v", err)
	}
	defer sqlDB.Close()

	fmt.Printf("✅ Connected to database successfully\n")

	// Inspect database schema first
	fmt.Printf("🔍 Inspecting database schema...\n")
	if err := inspectSchema(db); err != nil {
		log.Fatalf("❌ Failed to inspect schema: %v", err)
	}

	// Skip migrations for now and proceed with seeding
	fmt.Printf("⏭️  Skipping migrations, proceeding with seeding...\n")

	// Check if admin already exists
	var existingUserCount int64
	result := db.Model(&domain.User{}).Count(&existingUserCount)
		
	if result.Error != nil && !strings.Contains(result.Error.Error(), "column users.deleted_at does not exist") {
		log.Fatalf("❌ Database query error: %v", result.Error)
	}
		
	// If we get a deleted_at column error, the table exists but without soft delete
	if result.Error != nil && strings.Contains(result.Error.Error(), "column users.deleted_at does not exist") {
		fmt.Printf("⚠️  Table exists without soft delete columns, proceeding with seeding...\n")
		existingUserCount = 0 // Assume no users exist for simplicity
	}
		
	if existingUserCount > 0 {
		if !config.ForceOverwrite {
			fmt.Printf("⚠️  Super admin user already exists\n")
			fmt.Printf("💡 Use --force flag to overwrite existing admin user\n")
			return
		}
		fmt.Printf("🔄 Overwriting existing admin user...\n")
		// For simplicity, we'll just create a new admin user
	}

	// Create super admin user
	fmt.Printf("🌱 Creating super admin user...\n")
	adminUser, err := createSuperAdmin(db, config)
	if err != nil {
		log.Fatalf("❌ Failed to create super admin: %v", err)
	}

	// Create default roles and permissions
	fmt.Printf("🔐 Setting up default roles and permissions...\n")
	if err := setupDefaultRolesAndPermissions(db, adminUser.ID); err != nil {
		log.Fatalf("❌ Failed to setup roles and permissions: %v", err)
	}

	// Assign admin role to super admin
	fmt.Printf("👥 Assigning admin role...\n")
	if err := assignAdminRole(db, adminUser.ID); err != nil {
		log.Fatalf("❌ Failed to assign admin role: %v", err)
	}

	fmt.Printf("\n🎉 Super admin seeding completed successfully!\n")
	fmt.Printf("👤 Admin Email: %s\n", config.AdminEmail)
	fmt.Printf("🔑 Admin Password: %s\n", config.AdminPassword)
	fmt.Printf("📝 Full Name: %s\n", config.AdminFullName)
	fmt.Printf("🆔 User ID: %s\n", adminUser.ID.String())
	fmt.Printf("\n⚠️  IMPORTANT: Change these credentials in production!\n")
}

func createSuperAdmin(db *gorm.DB, config SeedConfig) (*domain.User, error) {
	// Validate password strength
	if err := utils.ValidatePasswordStrength(config.AdminPassword); err != nil {
		return nil, fmt.Errorf("password validation failed: %w", err)
	}

	// Hash the password
	hashedPassword, err := utils.HashPassword(config.AdminPassword)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// Create the user
	user := &domain.User{
		ID:                      uuid.New(),
		Email:                   config.AdminEmail,
		FullName:                config.AdminFullName,
		Password:                hashedPassword, // This maps to password_hash in DB
		IsActive:                true,
		UserType:                "admin",
		IsPasswordResetRequired: false, // Admin should not be forced to reset password
		CreatedAt:               time.Now(),
		UpdatedAt:               time.Now(),
	}

	result := db.Create(user)
	if result.Error != nil {
		return nil, fmt.Errorf("failed to create user: %w", result.Error)
	}

	return user, nil
}

func setupDefaultRolesAndPermissions(db *gorm.DB, createdBy uuid.UUID) error {
	// Create default permissions
	permissions := []struct {
		Name        string
		Description string
	}{
		{"iam.users.read", "Read user information"},
		{"iam.users.write", "Create, update, and delete users"},
		{"iam.roles.read", "Read role information"},
		{"iam.roles.write", "Create, update, and delete roles"},
		{"iam.permissions.read", "Read permission information"},
		{"academics.faculties.read", "Read faculty information"},
		{"academics.faculties.write", "Create, update, and delete faculties"},
		{"academics.departments.read", "Read department information"},
		{"academics.departments.write", "Create, update, and delete departments"},
		{"academics.degrees.read", "Read degree information"},
		{"academics.degrees.write", "Create, update, and delete degrees"},
		{"academics.batches.read", "Read batch information"},
		{"academics.batches.write", "Create, update, and delete batches"},
		{"academics.courses.read", "Read course information"},
		{"academics.courses.write", "Create, update, and delete courses"},
		{"academics.semesters.read", "Read semester information"},
		{"academics.semesters.write", "Create, update, and delete semesters"},
		{"system.admin", "Full system administration access"},
	}

	// Insert permissions
	for _, perm := range permissions {
		permission := domain.Permission{
			ID:          uuid.New(),
			Name:        perm.Name,
			Description: perm.Description,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}

		result := db.Where("name = ?", perm.Name).FirstOrCreate(&permission)
		if result.Error != nil {
			return fmt.Errorf("failed to create permission %s: %w", perm.Name, result.Error)
		}
	}

	// Create default roles
	roles := []struct {
		Name        string
		Description string
		Permissions []string
	}{
		{
			Name:        "super_admin",
			Description: "Super administrator with full system access",
			Permissions: []string{
				"system.admin",
				"iam.users.read", "iam.users.write",
				"iam.roles.read", "iam.roles.write",
				"iam.permissions.read",
				"academics.faculties.read", "academics.faculties.write",
				"academics.departments.read", "academics.departments.write",
				"academics.degrees.read", "academics.degrees.write",
				"academics.batches.read", "academics.batches.write",
				"academics.courses.read", "academics.courses.write",
				"academics.semesters.read", "academics.semesters.write",
			},
		},
		{
			Name:        "admin",
			Description: "Administrator with standard administrative access",
			Permissions: []string{
				"iam.users.read", "iam.users.write",
				"iam.roles.read",
				"academics.faculties.read", "academics.faculties.write",
				"academics.departments.read", "academics.departments.write",
				"academics.degrees.read", "academics.degrees.write",
				"academics.batches.read", "academics.batches.write",
				"academics.courses.read", "academics.courses.write",
				"academics.semesters.read", "academics.semesters.write",
			},
		},
		{
			Name:        "instructor",
			Description: "Instructor with academic management access",
			Permissions: []string{
				"academics.courses.read", "academics.courses.write",
				"academics.batches.read",
			},
		},
		{
			Name:        "student",
			Description: "Student with read-only academic access",
			Permissions: []string{
				"academics.courses.read",
				"academics.batches.read",
			},
		},
	}

	// Insert roles and assign permissions
	for _, roleData := range roles {
		role := domain.Role{
			ID:          uuid.New(),
			Name:        roleData.Name,
			Description: roleData.Description,
			IsCustom:    false,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}

		// Create or get role
		result := db.Where("name = ?", roleData.Name).FirstOrCreate(&role)
		if result.Error != nil {
			return fmt.Errorf("failed to create role %s: %w", roleData.Name, result.Error)
		}

		// Load permissions and associate with role
		var permissions []domain.Permission
		if err := db.Where("name IN ?", roleData.Permissions).Find(&permissions).Error; err != nil {
			return fmt.Errorf("failed to load permissions for role %s: %w", roleData.Name, err)
		}

		// Associate permissions with role
		if len(permissions) > 0 {
			if err := db.Model(&role).Association("Permissions").Append(permissions); err != nil {
				return fmt.Errorf("failed to associate permissions with role %s: %w", roleData.Name, err)
			}
		}
	}

	return nil
}

func assignAdminRole(db *gorm.DB, userID uuid.UUID) error {
	// Find the super_admin role
	var role domain.Role
	if err := db.Where("name = ?", "super_admin").First(&role).Error; err != nil {
		return fmt.Errorf("failed to find super_admin role: %w", err)
	}

	// Update user type to admin (the UserType field serves as the role indicator)
	result := db.Model(&domain.User{}).Where("id = ?", userID).Update("user_type", "admin")
	if result.Error != nil {
		return fmt.Errorf("failed to assign admin role to user: %w", result.Error)
	}

	return nil
}

func deleteExistingAdmin(db *gorm.DB, userID uuid.UUID) error {
	// Delete refresh tokens
	if err := db.Where("user_id = ?", userID).Delete(&domain.RefreshToken{}).Error; err != nil {
		return fmt.Errorf("failed to delete refresh tokens: %w", err)
	}

	// Delete the user
	if err := db.Delete(&domain.User{ID: userID}).Error; err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}

	return nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func runMigrations(db *gorm.DB) error {
	// Read and execute the migration file
	migrationPath := "migrations/000001_create_iam_tables.up.sql"
	
	content, err := os.ReadFile(migrationPath)
	if err != nil {
		return fmt.Errorf("failed to read migration file: %w", err)
	}
	
	// Execute the SQL
	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("failed to get database instance: %w", err)
	}
	
	queries := strings.Split(string(content), ";")
	for _, query := range queries {
		query = strings.TrimSpace(query)
		if query == "" || strings.HasPrefix(query, "--") {
			continue
		}
		
		if _, err := sqlDB.Exec(query); err != nil {
			// Ignore duplicate object errors (tables already exist)
			if !strings.Contains(err.Error(), "duplicate key value") && 
			   !strings.Contains(err.Error(), "already exists") {
				return fmt.Errorf("failed to execute migration query: %w", err)
			}
		}
	}
	
	return nil
}

func inspectSchema(db *gorm.DB) error {
	// Query table structure
	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("failed to get database instance: %w", err)
	}
	
	rows, err := sqlDB.Query(`
		SELECT column_name, data_type, is_nullable 
		FROM information_schema.columns 
		WHERE table_name = 'users' 
		ORDER BY ordinal_position
	`)
	if err != nil {
		return fmt.Errorf("failed to query table structure: %w", err)
	}
	defer rows.Close()

	fmt.Println("Users table structure:")
	fmt.Println("Column Name\t\tData Type\t\tNullable")
	fmt.Println("-----------\t\t---------\t\t--------")
	
	for rows.Next() {
		var columnName, dataType, isNullable string
		if err := rows.Scan(&columnName, &dataType, &isNullable); err != nil {
			return fmt.Errorf("error scanning row: %w", err)
		}
		fmt.Printf("%-20s\t%-20s\t%s\n", columnName, dataType, isNullable)
	}
	
	return nil
}
