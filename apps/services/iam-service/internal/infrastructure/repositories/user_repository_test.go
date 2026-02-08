package repositories

import (
	"context"
	"testing"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/application/ports"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupTestDB() (*gorm.DB, error) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	// Auto migrate the schema
	err = db.AutoMigrate(&domain.User{}, &domain.Student{}, &domain.Employee{})
	if err != nil {
		return nil, err
	}

	return db, nil
}

func TestUserRepository_Create(t *testing.T) {
	db, err := setupTestDB()
	if err != nil {
		t.Fatalf("Failed to setup test database: %v", err)
	}

	repo := NewUserRepository(db)
	ctx := context.Background()

	user := &domain.User{
		Email:        "test@example.com",
		FullName:     "Test User",
		PasswordHash: "hashedpassword",
		IsActive:     true,
		UserType:     "STUDENT",
	}

	err = repo.Create(ctx, user)
	if err != nil {
		t.Errorf("Create() error = %v", err)
	}

	// Verify the user was created with a generated ID
	if user.ID == "" {
		t.Error("Expected user ID to be generated")
	}
}

func TestUserRepository_GetByEmail(t *testing.T) {
	db, err := setupTestDB()
	if err != nil {
		t.Fatalf("Failed to setup test database: %v", err)
	}

	repo := NewUserRepository(db)
	ctx := context.Background()

	// Create a test user
	user := &domain.User{
		Email:        "test@example.com",
		FullName:     "Test User",
		PasswordHash: "hashedpassword",
		IsActive:     true,
		UserType:     "STUDENT",
	}

	err = repo.Create(ctx, user)
	if err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	// Test GetByEmail
	foundUser, err := repo.GetByEmail(ctx, "test@example.com")
	if err != nil {
		t.Errorf("GetByEmail() error = %v", err)
	}

	if foundUser == nil {
		t.Error("Expected user to be found")
	}

	if foundUser.Email != "test@example.com" {
		t.Errorf("Expected email %s, got %s", "test@example.com", foundUser.Email)
	}
}

func TestUserRepository_GetByID(t *testing.T) {
	db, err := setupTestDB()
	if err != nil {
		t.Fatalf("Failed to setup test database: %v", err)
	}

	repo := NewUserRepository(db)
	ctx := context.Background()

	// Create a test user
	user := &domain.User{
		Email:        "test@example.com",
		FullName:     "Test User",
		PasswordHash: "hashedpassword",
		IsActive:     true,
		UserType:     "STUDENT",
	}

	err = repo.Create(ctx, user)
	if err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	// Test GetByID
	foundUser, err := repo.GetByID(ctx, user.ID)
	if err != nil {
		t.Errorf("GetByID() error = %v", err)
	}

	if foundUser == nil {
		t.Error("Expected user to be found")
	}

	if foundUser.ID != user.ID {
		t.Errorf("Expected ID %s, got %s", user.ID, foundUser.ID)
	}
}

func TestUserRepository_Update(t *testing.T) {
	db, err := setupTestDB()
	if err != nil {
		t.Fatalf("Failed to setup test database: %v", err)
	}

	repo := NewUserRepository(db)
	ctx := context.Background()

	// Create a test user
	user := &domain.User{
		Email:        "test@example.com",
		FullName:     "Test User",
		PasswordHash: "hashedpassword",
		IsActive:     true,
		UserType:     "STUDENT",
	}

	err = repo.Create(ctx, user)
	if err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	// Update the user
	user.FullName = "Updated Test User"
	err = repo.Update(ctx, user)
	if err != nil {
		t.Errorf("Update() error = %v", err)
	}

	// Verify the update
	updatedUser, err := repo.GetByID(ctx, user.ID)
	if err != nil {
		t.Fatalf("Failed to get updated user: %v", err)
	}

	if updatedUser.FullName != "Updated Test User" {
		t.Errorf("Expected full name %s, got %s", "Updated Test User", updatedUser.FullName)
	}
}

func TestUserRepository_Delete(t *testing.T) {
	db, err := setupTestDB()
	if err != nil {
		t.Fatalf("Failed to setup test database: %v", err)
	}

	repo := NewUserRepository(db)
	ctx := context.Background()

	// Create a test user
	user := &domain.User{
		Email:        "test@example.com",
		FullName:     "Test User",
		PasswordHash: "hashedpassword",
		IsActive:     true,
		UserType:     "STUDENT",
	}

	err = repo.Create(ctx, user)
	if err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	// Delete the user
	err = repo.Delete(ctx, user.ID)
	if err != nil {
		t.Errorf("Delete() error = %v", err)
	}

	// Verify the user is soft deleted
	_, err = repo.GetByID(ctx, user.ID)
	if err == nil {
		t.Error("Expected error when getting deleted user")
	}
}

func TestUserRepository_List(t *testing.T) {
	db, err := setupTestDB()
	if err != nil {
		t.Fatalf("Failed to setup test database: %v", err)
	}

	repo := NewUserRepository(db)
	ctx := context.Background()

	// Create test users
	users := []*domain.User{
		{
			Email:        "student1@example.com",
			FullName:     "Student One",
			PasswordHash: "hashedpassword",
			IsActive:     true,
			UserType:     "STUDENT",
		},
		{
			Email:        "employee1@example.com",
			FullName:     "Employee One",
			PasswordHash: "hashedpassword",
			IsActive:     true,
			UserType:     "EMPLOYEE",
		},
		{
			Email:        "student2@example.com",
			FullName:     "Student Two",
			PasswordHash: "hashedpassword",
			IsActive:     false,
			UserType:     "STUDENT",
		},
	}

	for _, user := range users {
		err = repo.Create(ctx, user)
		if err != nil {
			t.Fatalf("Failed to create test user: %v", err)
		}
	}

	// Test listing all users
	filter := ports.UserFilter{
		Limit: 10,
	}

	foundUsers, total, err := repo.List(ctx, filter)
	if err != nil {
		t.Errorf("List() error = %v", err)
	}

	if int(total) != len(users) {
		t.Errorf("Expected total %d, got %d", len(users), total)
	}

	if len(foundUsers) != len(users) {
		t.Errorf("Expected %d users, got %d", len(users), len(foundUsers))
	}

	// Test filtering by user type
	userType := "STUDENT"
	filter = ports.UserFilter{
		UserType: &userType,
		Limit:    10,
	}

	studentUsers, studentTotal, err := repo.List(ctx, filter)
	if err != nil {
		t.Errorf("List() with filter error = %v", err)
	}

	if studentTotal != 2 {
		t.Errorf("Expected 2 students, got %d", studentTotal)
	}

	if len(studentUsers) != 2 {
		t.Errorf("Expected 2 student users, got %d", len(studentUsers))
	}
}

func TestUserRepository_SetPasswordResetRequired(t *testing.T) {
	db, err := setupTestDB()
	if err != nil {
		t.Fatalf("Failed to setup test database: %v", err)
	}

	repo := NewUserRepository(db)
	ctx := context.Background()

	// Create a test user
	user := &domain.User{
		Email:        "test@example.com",
		FullName:     "Test User",
		PasswordHash: "hashedpassword",
		IsActive:     true,
		UserType:     "STUDENT",
	}

	err = repo.Create(ctx, user)
	if err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	// Set password reset required
	err = repo.SetPasswordResetRequired(ctx, user.ID, true)
	if err != nil {
		t.Errorf("SetPasswordResetRequired() error = %v", err)
	}

	// Verify the flag is set
	updatedUser, err := repo.GetByID(ctx, user.ID)
	if err != nil {
		t.Fatalf("Failed to get updated user: %v", err)
	}

	if !updatedUser.IsPasswordResetReq {
		t.Error("Expected IsPasswordResetReq to be true")
	}
}

func TestUserRepository_SetActiveStatus(t *testing.T) {
	db, err := setupTestDB()
	if err != nil {
		t.Fatalf("Failed to setup test database: %v", err)
	}

	repo := NewUserRepository(db)
	ctx := context.Background()

	// Create a test user
	user := &domain.User{
		Email:        "test@example.com",
		FullName:     "Test User",
		PasswordHash: "hashedpassword",
		IsActive:     true,
		UserType:     "STUDENT",
	}

	err = repo.Create(ctx, user)
	if err != nil {
		t.Fatalf("Failed to create test user: %v", err)
	}

	// Set active status to false
	err = repo.SetActiveStatus(ctx, user.ID, false)
	if err != nil {
		t.Errorf("SetActiveStatus() error = %v", err)
	}

	// Verify the status is updated
	updatedUser, err := repo.GetByID(ctx, user.ID)
	if err != nil {
		t.Fatalf("Failed to get updated user: %v", err)
	}

	if updatedUser.IsActive {
		t.Error("Expected IsActive to be false")
	}
}
