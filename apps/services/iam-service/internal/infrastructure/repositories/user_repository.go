package repositories

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/application/ports"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain"
	"github.com/docker/distribution/uuid"
	"gorm.io/gorm"
)

type UserRepository struct {
	db *gorm.DB
}

// NewUserRepository creates a new instance of UserRepository
func NewUserRepository(db *gorm.DB) ports.UserRepository {
	return &UserRepository{
		db: db,
	}
}

// Create creates a new user in the database
func (r *UserRepository) Create(ctx context.Context, user *domain.User) error {
	if user.ID == "" {
		user.ID = uuid.Generate().String()
	}

	return r.db.WithContext(ctx).Create(user).Error
}

// GetByID retrieves a user by their ID
func (r *UserRepository) GetByID(ctx context.Context, id string) (*domain.User, error) {
	var user domain.User
	err := r.db.WithContext(ctx).
		Preload("Student").
		Preload("Employee").
		Where("id = ?", id).
		First(&user).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("user with ID %s not found", id)
		}
		return nil, fmt.Errorf("failed to get user by ID: %w", err)
	}

	return &user, nil
}

// GetByEmail retrieves a user by their email address
func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	var user domain.User
	err := r.db.WithContext(ctx).
		Preload("Student").
		Preload("Employee").
		Where("email = ?", email).
		First(&user).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("user with email %s not found", email)
		}
		return nil, fmt.Errorf("failed to get user by email: %w", err)
	}

	return &user, nil
}

// GetByStudentRegNo retrieves a user by student registration number
func (r *UserRepository) GetByStudentRegNo(ctx context.Context, studentRegNo string) (*domain.User, error) {
	var user domain.User
	err := r.db.WithContext(ctx).
		Preload("Student").
		Preload("Employee").
		Joins("JOIN students ON users.id = students.user_id").
		Where("students.student_reg_no = ?", studentRegNo).
		First(&user).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("user with student registration number %s not found", studentRegNo)
		}
		return nil, fmt.Errorf("failed to get user by student registration number: %w", err)
	}

	return &user, nil
}

// GetByEmployeeID retrieves a user by employee ID
func (r *UserRepository) GetByEmployeeID(ctx context.Context, employeeID string) (*domain.User, error) {
	var user domain.User
	err := r.db.WithContext(ctx).
		Preload("Student").
		Preload("Employee").
		Joins("JOIN employees ON users.id = employees.user_id").
		Where("employees.employee_id = ?", employeeID).
		First(&user).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("user with employee ID %s not found", employeeID)
		}
		return nil, fmt.Errorf("failed to get user by employee ID: %w", err)
	}

	return &user, nil
}

// Update updates an existing user
func (r *UserRepository) Update(ctx context.Context, user *domain.User) error {
	result := r.db.WithContext(ctx).Save(user)
	if result.Error != nil {
		return fmt.Errorf("failed to update user: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return fmt.Errorf("user with ID %s not found", user.ID)
	}

	return nil
}

// Delete soft deletes a user
func (r *UserRepository) Delete(ctx context.Context, id string) error {
	result := r.db.WithContext(ctx).Where("id = ?", id).Delete(&domain.User{})
	if result.Error != nil {
		return fmt.Errorf("failed to delete user: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return fmt.Errorf("user with ID %s not found", id)
	}

	return nil
}

// List retrieves users with pagination and filtering
func (r *UserRepository) List(ctx context.Context, filter ports.UserFilter) ([]*domain.User, int64, error) {
	query := r.db.WithContext(ctx).Model(&domain.User{}).
		Preload("Student").
		Preload("Employee")

	// Apply filters
	query = r.applyFilters(query, filter)

	// Get total count
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count users: %w", err)
	}

	// Apply pagination and ordering
	query = r.applyPaginationAndOrdering(query, filter)

	var users []*domain.User
	if err := query.Find(&users).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list users: %w", err)
	}

	return users, total, nil
}

// SetPasswordResetRequired sets the password reset required flag
func (r *UserRepository) SetPasswordResetRequired(ctx context.Context, id string, required bool) error {
	result := r.db.WithContext(ctx).
		Model(&domain.User{}).
		Where("id = ?", id).
		Update("is_password_reset_req", required)

	if result.Error != nil {
		return fmt.Errorf("failed to set password reset required: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return fmt.Errorf("user with ID %s not found", id)
	}

	return nil
}

// SetActiveStatus sets the active status of a user
func (r *UserRepository) SetActiveStatus(ctx context.Context, id string, isActive bool) error {
	result := r.db.WithContext(ctx).
		Model(&domain.User{}).
		Where("id = ?", id).
		Update("is_active", isActive)

	if result.Error != nil {
		return fmt.Errorf("failed to set active status: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return fmt.Errorf("user with ID %s not found", id)
	}

	return nil
}

// applyFilters applies filtering conditions to the query
func (r *UserRepository) applyFilters(query *gorm.DB, filter ports.UserFilter) *gorm.DB {
	if filter.UserType != nil {
		query = query.Where("user_type = ?", *filter.UserType)
	}

	if filter.IsActive != nil {
		query = query.Where("is_active = ?", *filter.IsActive)
	}

	if filter.Email != nil {
		query = query.Where("email ILIKE ?", "%"+*filter.Email+"%")
	}

	if filter.FullName != nil {
		query = query.Where("full_name ILIKE ?", "%"+*filter.FullName+"%")
	}

	return query
}

// applyPaginationAndOrdering applies pagination and ordering to the query
func (r *UserRepository) applyPaginationAndOrdering(query *gorm.DB, filter ports.UserFilter) *gorm.DB {
	// Apply ordering
	orderBy := "created_at"
	if filter.OrderBy != "" {
		orderBy = filter.OrderBy
	}

	orderDir := "DESC"
	if filter.OrderDir != "" {
		orderDir = strings.ToUpper(filter.OrderDir)
	}

	// Validate order direction
	if orderDir != "ASC" && orderDir != "DESC" {
		orderDir = "DESC"
	}

	query = query.Order(fmt.Sprintf("%s %s", orderBy, orderDir))

	// Apply pagination
	if filter.Limit > 0 {
		query = query.Limit(filter.Limit)
	}

	if filter.Offset > 0 {
		query = query.Offset(filter.Offset)
	}

	return query
}
