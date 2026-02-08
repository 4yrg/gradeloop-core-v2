package usecases

import (
	"context"
	"log"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/application/ports"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/repositories"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// ExampleIntegration demonstrates how to wire up use cases with repositories
func ExampleIntegration() {
	// 1. Initialize database connection (example with SQLite)
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	// 2. Auto-migrate the schema
	err = db.AutoMigrate(&domain.User{}, &domain.Student{}, &domain.Employee{})
	if err != nil {
		log.Fatal("Failed to migrate database:", err)
	}

	// 3. Create repository instances
	userRepo := repositories.NewUserRepository(db)

	// 4. Create logger (you can replace with your preferred logger)
	logger := &DefaultLogger{}

	// 5. Create dependencies
	deps := Dependencies{
		UserRepository: userRepo,
		Logger:         logger,
	}

	// 6. Create use case factory
	factory := NewUseCaseFactory(deps)

	// 7. Example usage of use cases
	ctx := context.Background()

	// Create a new student user
	studentRegNo := "STU2024001"
	createReq := ports.CreateUserRequest{
		Email:          "john.doe@university.edu",
		FullName:       "John Doe",
		Password:       "securepassword123",
		UserType:       "STUDENT",
		StudentRegNo:   &studentRegNo,
		EnrollmentDate: func() *string { s := time.Now().Format(time.RFC3339); return &s }(),
	}

	userResp, err := factory.UserUseCase.CreateUser(ctx, createReq)
	if err != nil {
		log.Printf("Error creating user: %v", err)
		return
	}

	log.Printf("Created user: %s (ID: %s)", userResp.FullName, userResp.UserID)

	// Get user by ID
	getResp, err := factory.UserUseCase.GetUser(ctx, userResp.UserID)
	if err != nil {
		log.Printf("Error getting user: %v", err)
		return
	}

	log.Printf("Retrieved user: %s (%s)", getResp.FullName, getResp.Email)

	// Validate user credentials
	validateResp, err := factory.UserUseCase.ValidateUser(ctx, userResp.Email, "securepassword123")
	if err != nil {
		log.Printf("Error validating user: %v", err)
		return
	}

	log.Printf("Validated user: %s", validateResp.FullName)

	// Update user password
	updatePasswordReq := ports.UpdateUserPasswordRequest{
		UserID:      userResp.UserID,
		OldPassword: "securepassword123",
		NewPassword: "newsecurepassword456",
	}

	err = factory.UserUseCase.UpdateUserPassword(ctx, updatePasswordReq)
	if err != nil {
		log.Printf("Error updating password: %v", err)
		return
	}

	log.Println("Password updated successfully")

	// List users
	listReq := ports.ListUsersRequest{
		Limit:  10,
		Offset: 0,
	}

	listResp, err := factory.UserUseCase.ListUsers(ctx, listReq)
	if err != nil {
		log.Printf("Error listing users: %v", err)
		return
	}

	log.Printf("Found %d users (total: %d)", len(listResp.Users), listResp.Total)

	// Search users
	searchReq := ports.SearchUsersRequest{
		Query: "John",
		Limit: 10,
	}

	searchResp, err := factory.UserUseCase.SearchUsers(ctx, searchReq)
	if err != nil {
		log.Printf("Error searching users: %v", err)
		return
	}

	log.Printf("Search results for '%s': %d users found", searchReq.Query, len(searchResp.Users))

	log.Println("Integration example completed successfully!")
}

// ExampleWithRealDatabase demonstrates integration with a real database
func ExampleWithRealDatabase() {
	// This example shows how you would set up with PostgreSQL
	// Uncomment and modify the DSN for your database

	/*
		// PostgreSQL example
		dsn := "host=localhost user=username password=password dbname=iam_service port=5432 sslmode=disable"
		db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
		if err != nil {
			log.Fatal("Failed to connect to database:", err)
		}

		// Auto-migrate the schema
		err = db.AutoMigrate(&domain.User{}, &domain.Student{}, &domain.Employee{})
		if err != nil {
			log.Fatal("Failed to migrate database:", err)
		}

		// Create repository instances
		userRepo := repositories.NewUserRepository(db)

		// Create custom logger (example with structured logging)
		logger := &CustomStructuredLogger{
			baseLogger: logrus.New(),
		}

		// Create dependencies
		deps := Dependencies{
			UserRepository: userRepo,
			Logger:         logger,
		}

		// Create use case factory with configuration
		config := Config{
			PasswordResetTokenExpiry: 60, // 1 hour
			MaxLoginAttempts:         5,
			AccountLockoutDuration:   30, // 30 minutes
		}

		factory := NewUseCaseFactoryWithConfig(deps, config)

		// Use the factory to access use cases
		userUseCase := factory.UserUseCase

		// Example usage...
	*/

	log.Println("See commented code for real database integration example")
}

// ExampleBulkOperations demonstrates bulk user operations
func ExampleBulkOperations() {
	// Setup (same as ExampleIntegration)
	db, _ := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	db.AutoMigrate(&domain.User{}, &domain.Student{}, &domain.Employee{})

	userRepo := repositories.NewUserRepository(db)
	logger := &DefaultLogger{}
	deps := Dependencies{UserRepository: userRepo, Logger: logger}
	factory := NewUseCaseFactory(deps)

	ctx := context.Background()

	// Create multiple users
	students := []struct {
		name  string
		email string
		regNo string
	}{
		{"Alice Johnson", "alice.johnson@university.edu", "STU2024001"},
		{"Bob Smith", "bob.smith@university.edu", "STU2024002"},
		{"Carol Davis", "carol.davis@university.edu", "STU2024003"},
	}

	var createdUsers []string

	for _, student := range students {
		req := ports.CreateUserRequest{
			Email:        student.email,
			FullName:     student.name,
			Password:     "defaultpassword123",
			UserType:     "STUDENT",
			StudentRegNo: &student.regNo,
		}

		resp, err := factory.UserUseCase.CreateUser(ctx, req)
		if err != nil {
			log.Printf("Error creating user %s: %v", student.name, err)
			continue
		}

		createdUsers = append(createdUsers, resp.UserID)
		log.Printf("Created student: %s (ID: %s)", resp.FullName, resp.UserID)
	}

	// List all students
	userType := "STUDENT"
	listReq := ports.ListUsersRequest{
		UserType: &userType,
		Limit:    10,
	}

	listResp, err := factory.UserUseCase.ListUsers(ctx, listReq)
	if err != nil {
		log.Printf("Error listing students: %v", err)
		return
	}

	log.Printf("Total students created: %d", len(listResp.Users))

	// Demonstrate batch deactivation
	for _, userID := range createdUsers {
		err := factory.UserUseCase.DeactivateUser(ctx, userID, "Bulk deactivation example")
		if err != nil {
			log.Printf("Error deactivating user %s: %v", userID, err)
		} else {
			log.Printf("Deactivated user: %s", userID)
		}
	}

	log.Println("Bulk operations example completed!")
}

// ExampleErrorHandling demonstrates proper error handling patterns
func ExampleErrorHandling() {
	db, _ := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	db.AutoMigrate(&domain.User{}, &domain.Student{}, &domain.Employee{})

	userRepo := repositories.NewUserRepository(db)
	logger := &DefaultLogger{}
	deps := Dependencies{UserRepository: userRepo, Logger: logger}
	factory := NewUseCaseFactory(deps)

	ctx := context.Background()

	// Example 1: Handle validation errors
	invalidReq := ports.CreateUserRequest{
		Email:    "invalid-email",
		FullName: "A",       // Too short
		Password: "123",     // Too short
		UserType: "INVALID", // Invalid type
	}

	_, err := factory.UserUseCase.CreateUser(ctx, invalidReq)
	if err != nil {
		if useCaseErr, ok := err.(*ports.UseCaseError); ok {
			switch useCaseErr.Code {
			case ports.ErrCodeValidation:
				log.Printf("Validation error: %s", useCaseErr.Message)
			case ports.ErrCodeAlreadyExists:
				log.Printf("Resource already exists: %s", useCaseErr.Message)
			case ports.ErrCodeNotFound:
				log.Printf("Resource not found: %s", useCaseErr.Message)
			case ports.ErrCodeInternal:
				log.Printf("Internal error: %s", useCaseErr.Message)
			default:
				log.Printf("Unknown error: %s", useCaseErr.Message)
			}
		} else {
			log.Printf("Unexpected error type: %v", err)
		}
	}

	// Example 2: Handle not found errors
	_, err = factory.UserUseCase.GetUser(ctx, "non-existent-user-id")
	if err != nil {
		if useCaseErr, ok := err.(*ports.UseCaseError); ok && useCaseErr.Code == ports.ErrCodeNotFound {
			log.Println("User not found - this is expected")
		}
	}

	// Example 3: Handle authentication errors
	_, err = factory.UserUseCase.ValidateUser(ctx, "test@example.com", "wrongpassword")
	if err != nil {
		if useCaseErr, ok := err.(*ports.UseCaseError); ok {
			switch useCaseErr.Code {
			case ports.ErrCodeUnauthorized:
				log.Println("Invalid credentials provided")
			case ports.ErrCodeUserInactive:
				log.Println("User account is inactive")
			case ports.ErrCodePasswordResetReq:
				log.Println("Password reset is required")
			}
		}
	}

	log.Println("Error handling examples completed!")
}

// Example of a custom structured logger implementation
type CustomStructuredLogger struct {
	// You would implement this with your preferred logging library
	// like logrus, zap, or any other structured logger
}

func (l *CustomStructuredLogger) Info(msg string, fields ...interface{}) {
	log.Printf("[INFO] %s %v", msg, fields)
}

func (l *CustomStructuredLogger) Error(msg string, fields ...interface{}) {
	log.Printf("[ERROR] %s %v", msg, fields)
}

func (l *CustomStructuredLogger) Debug(msg string, fields ...interface{}) {
	log.Printf("[DEBUG] %s %v", msg, fields)
}

func (l *CustomStructuredLogger) Warn(msg string, fields ...interface{}) {
	log.Printf("[WARN] %s %v", msg, fields)
}
