package services

import (
	"errors"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/utils"
)

// UserService handles user-related operations
type UserService struct {
	DB *gorm.DB
}

// NewUserService creates a new user service instance
func NewUserService(db *gorm.DB) *UserService {
	return &UserService{
		DB: db,
	}
}

// CreateUser creates a new user with the specified type
func (s *UserService) CreateUser(email, fullName, password, userType string) (*domain.User, error) {
	// Validate password strength
	if err := utils.ValidatePasswordStrength(password); err != nil {
		return nil, fmt.Errorf("password validation failed: %w", err)
	}

	// Hash the password
	hashedPassword, err := utils.HashPassword(password)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// Create the user
	user := &domain.User{
		ID:                      uuid.New(),
		Email:                   email,
		FullName:                fullName,
		Password:                hashedPassword,
		IsActive:                true,
		UserType:                userType,
		IsPasswordResetRequired: true, // Require password reset on first login
	}

	result := s.DB.Create(user)
	if result.Error != nil {
		return nil, fmt.Errorf("failed to create user: %w", result.Error)
	}

	return user, nil
}

// GetUserByID retrieves a user by ID
func (s *UserService) GetUserByID(userID uuid.UUID) (*domain.User, error) {
	var user domain.User
	result := s.DB.First(&user, "id = ?", userID)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return nil, errors.New("user not found")
	}
	if result.Error != nil {
		return nil, fmt.Errorf("failed to retrieve user: %w", result.Error)
	}

	return &user, nil
}

// GetUserByEmail retrieves a user by email
func (s *UserService) GetUserByEmail(email string) (*domain.User, error) {
	var user domain.User
	result := s.DB.First(&user, "email = ?", email)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return nil, errors.New("user not found")
	}
	if result.Error != nil {
		return nil, fmt.Errorf("failed to retrieve user: %w", result.Error)
	}

	return &user, nil
}

// UpdateUser updates a user's information
func (s *UserService) UpdateUser(userID uuid.UUID, fullName *string, isActive *bool) (*domain.User, error) {
	var user domain.User
	result := s.DB.First(&user, "id = ?", userID)
	if errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return nil, errors.New("user not found")
	}
	if result.Error != nil {
		return nil, fmt.Errorf("failed to retrieve user: %w", result.Error)
	}

	updates := make(map[string]interface{})
	if fullName != nil {
		updates["full_name"] = *fullName
	}
	if isActive != nil {
		updates["is_active"] = *isActive
	}

	result = s.DB.Model(&user).Updates(updates)
	if result.Error != nil {
		return nil, fmt.Errorf("failed to update user: %w", result.Error)
	}

	return &user, nil
}

// DeleteUser permanently deletes a user (hard delete)
func (s *UserService) DeleteUser(userID uuid.UUID) error {
	result := s.DB.Delete(&domain.User{}, "id = ?", userID)
	if result.Error != nil {
		return fmt.Errorf("failed to delete user: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return errors.New("user not found")
	}

	return nil
}

// SoftDeleteUser soft deletes a user
func (s *UserService) SoftDeleteUser(userID uuid.UUID) error {
	result := s.DB.Delete(&domain.User{}, "id = ?", userID)
	if result.Error != nil {
		return fmt.Errorf("failed to soft delete user: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return errors.New("user not found")
	}

	return nil
}

// RestoreUser restores a soft deleted user
func (s *UserService) RestoreUser(userID uuid.UUID) error {
	result := s.DB.Unscoped().Model(&domain.User{}).Where("id = ?", userID).Update("deleted_at", nil)
	if result.Error != nil {
		return fmt.Errorf("failed to restore user: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return errors.New("user not found or not deleted")
	}

	return nil
}

// ListUsers lists all users (excluding soft deleted ones by default)
func (s *UserService) ListUsers(includeDeleted bool) ([]domain.User, error) {
	var users []domain.User
	query := s.DB

	if !includeDeleted {
		query = query.Where("deleted_at IS NULL")
	}

	result := query.Find(&users)
	if result.Error != nil {
		return nil, fmt.Errorf("failed to list users: %w", result.Error)
	}

	return users, nil
}
