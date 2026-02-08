package usecases

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/application/ports"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain"
	"golang.org/x/crypto/bcrypt"
)

// Mock repository for testing
type mockUserRepository struct {
	users     map[string]*domain.User
	students  map[string]*domain.User // indexed by student reg no
	employees map[string]*domain.User // indexed by employee ID
	emails    map[string]*domain.User // indexed by email
}

func newMockUserRepository() *mockUserRepository {
	return &mockUserRepository{
		users:     make(map[string]*domain.User),
		students:  make(map[string]*domain.User),
		employees: make(map[string]*domain.User),
		emails:    make(map[string]*domain.User),
	}
}

func (m *mockUserRepository) Create(ctx context.Context, user *domain.User) error {
	if user.ID == "" {
		user.ID = "generated-id-" + user.Email
	}
	user.CreatedAt = time.Now()
	user.UpdatedAt = time.Now()

	m.users[user.ID] = user
	m.emails[user.Email] = user

	if user.Student != nil {
		user.Student.UserID = user.ID
		m.students[user.Student.StudentRegNo] = user
	}
	if user.Employee != nil {
		user.Employee.UserID = user.ID
		m.employees[user.Employee.EmployeeID] = user
	}

	return nil
}

func (m *mockUserRepository) GetByID(ctx context.Context, id string) (*domain.User, error) {
	user, exists := m.users[id]
	if !exists {
		return nil, errors.New("user with ID " + id + " not found")
	}
	return user, nil
}

func (m *mockUserRepository) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	user, exists := m.emails[email]
	if !exists {
		return nil, errors.New("user with email " + email + " not found")
	}
	return user, nil
}

func (m *mockUserRepository) GetByStudentRegNo(ctx context.Context, studentRegNo string) (*domain.User, error) {
	user, exists := m.students[studentRegNo]
	if !exists {
		return nil, errors.New("user with student registration number " + studentRegNo + " not found")
	}
	return user, nil
}

func (m *mockUserRepository) GetByEmployeeID(ctx context.Context, employeeID string) (*domain.User, error) {
	user, exists := m.employees[employeeID]
	if !exists {
		return nil, errors.New("user with employee ID " + employeeID + " not found")
	}
	return user, nil
}

func (m *mockUserRepository) Update(ctx context.Context, user *domain.User) error {
	existing, exists := m.users[user.ID]
	if !exists {
		return errors.New("user with ID " + user.ID + " not found")
	}

	// Update indexes if email changed
	if existing.Email != user.Email {
		delete(m.emails, existing.Email)
		m.emails[user.Email] = user
	}

	user.UpdatedAt = time.Now()
	m.users[user.ID] = user

	// Update type-specific indexes
	if user.Student != nil {
		m.students[user.Student.StudentRegNo] = user
	}
	if user.Employee != nil {
		m.employees[user.Employee.EmployeeID] = user
	}

	return nil
}

func (m *mockUserRepository) Delete(ctx context.Context, id string) error {
	user, exists := m.users[id]
	if !exists {
		return errors.New("user with ID " + id + " not found")
	}

	delete(m.users, id)
	delete(m.emails, user.Email)

	if user.Student != nil {
		delete(m.students, user.Student.StudentRegNo)
	}
	if user.Employee != nil {
		delete(m.employees, user.Employee.EmployeeID)
	}

	return nil
}

func (m *mockUserRepository) List(ctx context.Context, filter ports.UserFilter) ([]*domain.User, int64, error) {
	var result []*domain.User

	for _, user := range m.users {
		matches := true

		if filter.UserType != nil && user.UserType != *filter.UserType {
			matches = false
		}
		if filter.IsActive != nil && user.IsActive != *filter.IsActive {
			matches = false
		}
		if filter.Email != nil && !contains(user.Email, *filter.Email) {
			matches = false
		}
		if filter.FullName != nil && !contains(user.FullName, *filter.FullName) {
			matches = false
		}

		if matches {
			result = append(result, user)
		}
	}

	total := int64(len(result))

	// Apply pagination
	if filter.Offset > 0 {
		if filter.Offset >= len(result) {
			result = []*domain.User{}
		} else {
			result = result[filter.Offset:]
		}
	}

	if filter.Limit > 0 && filter.Limit < len(result) {
		result = result[:filter.Limit]
	}

	return result, total, nil
}

func (m *mockUserRepository) SetPasswordResetRequired(ctx context.Context, id string, required bool) error {
	user, exists := m.users[id]
	if !exists {
		return errors.New("user with ID " + id + " not found")
	}

	user.IsPasswordResetReq = required
	return nil
}

func (m *mockUserRepository) SetActiveStatus(ctx context.Context, id string, isActive bool) error {
	user, exists := m.users[id]
	if !exists {
		return errors.New("user with ID " + id + " not found")
	}

	user.IsActive = isActive
	return nil
}

// Helper function
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || containsSubstring(s, substr))
}

func containsSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// Test helper functions
func setupUserUseCase() (ports.UserUseCase, *mockUserRepository) {
	repo := newMockUserRepository()
	useCase := NewUserUseCase(repo, &DefaultLogger{})
	return useCase, repo
}

func hashPassword(password string) string {
	bytes, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes)
}

// Test CreateUser
func TestUserUseCase_CreateUser(t *testing.T) {
	useCase, _ := setupUserUseCase()
	ctx := context.Background()

	t.Run("CreateStudentUser", func(t *testing.T) {
		studentRegNo := "STU2024001"
		req := ports.CreateUserRequest{
			Email:          "john.doe@university.edu",
			FullName:       "John Doe",
			Password:       "password123",
			UserType:       "STUDENT",
			StudentRegNo:   &studentRegNo,
			EnrollmentDate: stringPtr("2024-01-15T00:00:00Z"),
		}

		resp, err := useCase.CreateUser(ctx, req)
		if err != nil {
			t.Errorf("CreateUser() error = %v", err)
			return
		}

		if resp.Email != req.Email {
			t.Errorf("Expected email %s, got %s", req.Email, resp.Email)
		}

		if resp.UserType != "STUDENT" {
			t.Errorf("Expected user type STUDENT, got %s", resp.UserType)
		}

		if resp.Student == nil {
			t.Error("Expected student details to be present")
		} else if resp.Student.StudentRegNo != studentRegNo {
			t.Errorf("Expected student reg no %s, got %s", studentRegNo, resp.Student.StudentRegNo)
		}
	})

	t.Run("CreateEmployeeUser", func(t *testing.T) {
		employeeID := "EMP2024001"
		designation := "Professor"
		req := ports.CreateUserRequest{
			Email:       "jane.smith@university.edu",
			FullName:    "Jane Smith",
			Password:    "password123",
			UserType:    "EMPLOYEE",
			EmployeeID:  &employeeID,
			Designation: &designation,
		}

		resp, err := useCase.CreateUser(ctx, req)
		if err != nil {
			t.Errorf("CreateUser() error = %v", err)
			return
		}

		if resp.Employee == nil {
			t.Error("Expected employee details to be present")
		} else {
			if resp.Employee.EmployeeID != employeeID {
				t.Errorf("Expected employee ID %s, got %s", employeeID, resp.Employee.EmployeeID)
			}
			if resp.Employee.Designation != designation {
				t.Errorf("Expected designation %s, got %s", designation, resp.Employee.Designation)
			}
		}
	})

	t.Run("CreateUserDuplicateEmail", func(t *testing.T) {
		// First user
		studentRegNo1 := "STU2024002"
		req1 := ports.CreateUserRequest{
			Email:        "duplicate@university.edu",
			FullName:     "User One",
			Password:     "password123",
			UserType:     "STUDENT",
			StudentRegNo: &studentRegNo1,
		}

		_, err := useCase.CreateUser(ctx, req1)
		if err != nil {
			t.Errorf("First CreateUser() error = %v", err)
			return
		}

		// Second user with same email
		studentRegNo2 := "STU2024003"
		req2 := ports.CreateUserRequest{
			Email:        "duplicate@university.edu",
			FullName:     "User Two",
			Password:     "password123",
			UserType:     "STUDENT",
			StudentRegNo: &studentRegNo2,
		}

		_, err = useCase.CreateUser(ctx, req2)
		if err == nil {
			t.Error("Expected error for duplicate email")
		}

		if useCaseErr, ok := err.(*ports.UseCaseError); ok {
			if useCaseErr.Code != ports.ErrCodeAlreadyExists {
				t.Errorf("Expected error code %s, got %s", ports.ErrCodeAlreadyExists, useCaseErr.Code)
			}
		} else {
			t.Errorf("Expected UseCaseError, got %T", err)
		}
	})

	t.Run("CreateUserInvalidInput", func(t *testing.T) {
		req := ports.CreateUserRequest{
			Email:    "",
			FullName: "Test User",
			Password: "password123",
			UserType: "STUDENT",
		}

		_, err := useCase.CreateUser(ctx, req)
		if err == nil {
			t.Error("Expected validation error")
		}

		if useCaseErr, ok := err.(*ports.UseCaseError); ok {
			if useCaseErr.Code != ports.ErrCodeValidation {
				t.Errorf("Expected error code %s, got %s", ports.ErrCodeValidation, useCaseErr.Code)
			}
		}
	})
}

// Test GetUser
func TestUserUseCase_GetUser(t *testing.T) {
	useCase, repo := setupUserUseCase()
	ctx := context.Background()

	// Create test user
	testUser := &domain.User{
		ID:           "test-user-id",
		Email:        "test@example.com",
		FullName:     "Test User",
		PasswordHash: hashPassword("password123"),
		IsActive:     true,
		UserType:     "STUDENT",
		Student: &domain.Student{
			StudentRegNo:   "STU2024001",
			EnrollmentDate: time.Now(),
		},
	}
	repo.Create(ctx, testUser)

	t.Run("GetExistingUser", func(t *testing.T) {
		resp, err := useCase.GetUser(ctx, testUser.ID)
		if err != nil {
			t.Errorf("GetUser() error = %v", err)
			return
		}

		if resp.UserID != testUser.ID {
			t.Errorf("Expected user ID %s, got %s", testUser.ID, resp.UserID)
		}

		if resp.Email != testUser.Email {
			t.Errorf("Expected email %s, got %s", testUser.Email, resp.Email)
		}

		if resp.Student == nil {
			t.Error("Expected student details to be present")
		}
	})

	t.Run("GetNonExistentUser", func(t *testing.T) {
		_, err := useCase.GetUser(ctx, "non-existent-id")
		if err == nil {
			t.Error("Expected error for non-existent user")
		}

		if useCaseErr, ok := err.(*ports.UseCaseError); ok {
			if useCaseErr.Code != ports.ErrCodeNotFound {
				t.Errorf("Expected error code %s, got %s", ports.ErrCodeNotFound, useCaseErr.Code)
			}
		}
	})
}

// Test UpdateUserPassword
func TestUserUseCase_UpdateUserPassword(t *testing.T) {
	useCase, repo := setupUserUseCase()
	ctx := context.Background()

	// Create test user
	oldPassword := "oldpassword123"
	testUser := &domain.User{
		ID:           "test-user-id",
		Email:        "test@example.com",
		FullName:     "Test User",
		PasswordHash: hashPassword(oldPassword),
		IsActive:     true,
		UserType:     "STUDENT",
	}
	repo.Create(ctx, testUser)

	t.Run("UpdatePasswordSuccess", func(t *testing.T) {
		req := ports.UpdateUserPasswordRequest{
			UserID:      testUser.ID,
			OldPassword: oldPassword,
			NewPassword: "newpassword123",
		}

		err := useCase.UpdateUserPassword(ctx, req)
		if err != nil {
			t.Errorf("UpdateUserPassword() error = %v", err)
		}

		// Verify password was updated
		updatedUser, _ := repo.GetByID(ctx, testUser.ID)
		if bcrypt.CompareHashAndPassword([]byte(updatedUser.PasswordHash), []byte("newpassword123")) != nil {
			t.Error("Password was not updated correctly")
		}
	})

	t.Run("UpdatePasswordWrongOldPassword", func(t *testing.T) {
		req := ports.UpdateUserPasswordRequest{
			UserID:      testUser.ID,
			OldPassword: "wrongpassword",
			NewPassword: "newpassword123",
		}

		err := useCase.UpdateUserPassword(ctx, req)
		if err == nil {
			t.Error("Expected error for wrong old password")
		}

		if useCaseErr, ok := err.(*ports.UseCaseError); ok {
			if useCaseErr.Code != ports.ErrCodeUnauthorized {
				t.Errorf("Expected error code %s, got %s", ports.ErrCodeUnauthorized, useCaseErr.Code)
			}
		}
	})
}

// Test ValidateUser
func TestUserUseCase_ValidateUser(t *testing.T) {
	useCase, repo := setupUserUseCase()
	ctx := context.Background()

	password := "testpassword123"
	testUser := &domain.User{
		ID:           "test-user-id",
		Email:        "test@example.com",
		FullName:     "Test User",
		PasswordHash: hashPassword(password),
		IsActive:     true,
		UserType:     "STUDENT",
	}
	repo.Create(ctx, testUser)

	t.Run("ValidateUserSuccess", func(t *testing.T) {
		resp, err := useCase.ValidateUser(ctx, testUser.Email, password)
		if err != nil {
			t.Errorf("ValidateUser() error = %v", err)
			return
		}

		if resp.UserID != testUser.ID {
			t.Errorf("Expected user ID %s, got %s", testUser.ID, resp.UserID)
		}

		if resp.Email != testUser.Email {
			t.Errorf("Expected email %s, got %s", testUser.Email, resp.Email)
		}
	})

	t.Run("ValidateUserWrongPassword", func(t *testing.T) {
		_, err := useCase.ValidateUser(ctx, testUser.Email, "wrongpassword")
		if err == nil {
			t.Error("Expected error for wrong password")
		}

		if useCaseErr, ok := err.(*ports.UseCaseError); ok {
			if useCaseErr.Code != ports.ErrCodeUnauthorized {
				t.Errorf("Expected error code %s, got %s", ports.ErrCodeUnauthorized, useCaseErr.Code)
			}
		}
	})

	t.Run("ValidateInactiveUser", func(t *testing.T) {
		// Create inactive user
		inactiveUser := &domain.User{
			ID:           "inactive-user-id",
			Email:        "inactive@example.com",
			FullName:     "Inactive User",
			PasswordHash: hashPassword(password),
			IsActive:     false,
			UserType:     "STUDENT",
		}
		repo.Create(ctx, inactiveUser)

		_, err := useCase.ValidateUser(ctx, inactiveUser.Email, password)
		if err == nil {
			t.Error("Expected error for inactive user")
		}

		if useCaseErr, ok := err.(*ports.UseCaseError); ok {
			if useCaseErr.Code != ports.ErrCodeUserInactive {
				t.Errorf("Expected error code %s, got %s", ports.ErrCodeUserInactive, useCaseErr.Code)
			}
		}
	})
}

// Test ListUsers
func TestUserUseCase_ListUsers(t *testing.T) {
	useCase, repo := setupUserUseCase()
	ctx := context.Background()

	// Create test users
	users := []*domain.User{
		{
			ID:       "student-1",
			Email:    "student1@example.com",
			FullName: "Student One",
			IsActive: true,
			UserType: "STUDENT",
		},
		{
			ID:       "student-2",
			Email:    "student2@example.com",
			FullName: "Student Two",
			IsActive: false,
			UserType: "STUDENT",
		},
		{
			ID:       "employee-1",
			Email:    "employee1@example.com",
			FullName: "Employee One",
			IsActive: true,
			UserType: "EMPLOYEE",
		},
	}

	for _, user := range users {
		repo.Create(ctx, user)
	}

	t.Run("ListAllUsers", func(t *testing.T) {
		req := ports.ListUsersRequest{
			Limit: 10,
		}

		resp, err := useCase.ListUsers(ctx, req)
		if err != nil {
			t.Errorf("ListUsers() error = %v", err)
			return
		}

		if len(resp.Users) != 3 {
			t.Errorf("Expected 3 users, got %d", len(resp.Users))
		}

		if resp.Total != 3 {
			t.Errorf("Expected total 3, got %d", resp.Total)
		}
	})

	t.Run("ListStudentsOnly", func(t *testing.T) {
		userType := "STUDENT"
		req := ports.ListUsersRequest{
			UserType: &userType,
			Limit:    10,
		}

		resp, err := useCase.ListUsers(ctx, req)
		if err != nil {
			t.Errorf("ListUsers() error = %v", err)
			return
		}

		if len(resp.Users) != 2 {
			t.Errorf("Expected 2 students, got %d", len(resp.Users))
		}

		if resp.Total != 2 {
			t.Errorf("Expected total 2, got %d", resp.Total)
		}
	})

	t.Run("ListActiveUsersOnly", func(t *testing.T) {
		isActive := true
		req := ports.ListUsersRequest{
			IsActive: &isActive,
			Limit:    10,
		}

		resp, err := useCase.ListUsers(ctx, req)
		if err != nil {
			t.Errorf("ListUsers() error = %v", err)
			return
		}

		if len(resp.Users) != 2 {
			t.Errorf("Expected 2 active users, got %d", len(resp.Users))
		}
	})
}

// Test SearchUsers
func TestUserUseCase_SearchUsers(t *testing.T) {
	useCase, repo := setupUserUseCase()
	ctx := context.Background()

	// Create test users
	users := []*domain.User{
		{
			ID:       "user-1",
			Email:    "john.doe@example.com",
			FullName: "John Doe",
			IsActive: true,
			UserType: "STUDENT",
		},
		{
			ID:       "user-2",
			Email:    "jane.smith@example.com",
			FullName: "Jane Smith",
			IsActive: true,
			UserType: "EMPLOYEE",
		},
		{
			ID:       "user-3",
			Email:    "john.wilson@example.com",
			FullName: "John Wilson",
			IsActive: true,
			UserType: "STUDENT",
		},
	}

	for _, user := range users {
		repo.Create(ctx, user)
	}

	t.Run("SearchByName", func(t *testing.T) {
		req := ports.SearchUsersRequest{
			Query: "John",
			Limit: 10,
		}

		resp, err := useCase.SearchUsers(ctx, req)
		if err != nil {
			t.Errorf("SearchUsers() error = %v", err)
			return
		}

		if len(resp.Users) != 2 {
			t.Errorf("Expected 2 users named John, got %d", len(resp.Users))
		}

		if resp.Query != "John" {
			t.Errorf("Expected query 'John', got %s", resp.Query)
		}
	})

	t.Run("SearchByEmail", func(t *testing.T) {
		req := ports.SearchUsersRequest{
			Query: "jane.smith",
			Limit: 10,
		}

		resp, err := useCase.SearchUsers(ctx, req)
		if err != nil {
			t.Errorf("SearchUsers() error = %v", err)
			return
		}

		if len(resp.Users) != 1 {
			t.Errorf("Expected 1 user, got %d", len(resp.Users))
		}

		if len(resp.Users) > 0 && resp.Users[0].Email != "jane.smith@example.com" {
			t.Errorf("Expected email jane.smith@example.com, got %s", resp.Users[0].Email)
		}
	})
}

// Test RequestPasswordReset
func TestUserUseCase_RequestPasswordReset(t *testing.T) {
	useCase, repo := setupUserUseCase()
	ctx := context.Background()

	testUser := &domain.User{
		ID:           "test-user-id",
		Email:        "test@example.com",
		FullName:     "Test User",
		PasswordHash: hashPassword("password123"),
		IsActive:     true,
		UserType:     "STUDENT",
	}
	repo.Create(ctx, testUser)

	t.Run("RequestPasswordResetSuccess", func(t *testing.T) {
		err := useCase.RequestPasswordReset(ctx, testUser.Email)
		if err != nil {
			t.Errorf("RequestPasswordReset() error = %v", err)
		}

		// Verify reset flag was set
		updatedUser, _ := repo.GetByID(ctx, testUser.ID)
		if !updatedUser.IsPasswordResetReq {
			t.Error("Expected password reset flag to be set")
		}
	})

	t.Run("RequestPasswordResetNonExistentUser", func(t *testing.T) {
		err := useCase.RequestPasswordReset(ctx, "nonexistent@example.com")
		// Should not return error (security - don't reveal if user exists)
		if err != nil {
			t.Errorf("RequestPasswordReset() should not error for non-existent user, got %v", err)
		}
	})
}

// Test ActivateUser and DeactivateUser
func TestUserUseCase_ActivateDeactivateUser(t *testing.T) {
	useCase, repo := setupUserUseCase()
	ctx := context.Background()

	testUser := &domain.User{
		ID:           "test-user-id",
		Email:        "test@example.com",
		FullName:     "Test User",
		PasswordHash: hashPassword("password123"),
		IsActive:     true,
		UserType:     "STUDENT",
	}
	repo.Create(ctx, testUser)

	t.Run("DeactivateUser", func(t *testing.T) {
		err := useCase.DeactivateUser(ctx, testUser.ID, "Test deactivation")
		if err != nil {
			t.Errorf("DeactivateUser() error = %v", err)
		}

		// Verify user was deactivated
		updatedUser, _ := repo.GetByID(ctx, testUser.ID)
		if updatedUser.IsActive {
			t.Error("Expected user to be inactive")
		}
	})

	t.Run("ActivateUser", func(t *testing.T) {
		err := useCase.ActivateUser(ctx, testUser.ID)
		if err != nil {
			t.Errorf("ActivateUser() error = %v", err)
		}

		// Verify user was activated
		updatedUser, _ := repo.GetByID(ctx, testUser.ID)
		if !updatedUser.IsActive {
			t.Error("Expected user to be active")
		}
	})
}

// Helper function
func stringPtr(s string) *string {
	return &s
}
