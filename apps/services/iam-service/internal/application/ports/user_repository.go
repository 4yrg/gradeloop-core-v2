package ports

import (
	"context"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain"
)

// UserRepository defines the interface for user data operations
type UserRepository interface {
	// Create creates a new user in the database
	Create(ctx context.Context, user *domain.User) error

	// GetByID retrieves a user by their ID
	GetByID(ctx context.Context, id string) (*domain.User, error)

	// GetByEmail retrieves a user by their email address
	GetByEmail(ctx context.Context, email string) (*domain.User, error)

	// GetByStudentRegNo retrieves a user by student registration number
	GetByStudentRegNo(ctx context.Context, studentRegNo string) (*domain.User, error)

	// GetByEmployeeID retrieves a user by employee ID
	GetByEmployeeID(ctx context.Context, employeeID string) (*domain.User, error)

	// Update updates an existing user
	Update(ctx context.Context, user *domain.User) error

	// Delete soft deletes a user
	Delete(ctx context.Context, id string) error

	// List retrieves users with pagination and filtering
	List(ctx context.Context, filter UserFilter) ([]*domain.User, int64, error)

	// SetPasswordResetRequired sets the password reset required flag
	SetPasswordResetRequired(ctx context.Context, id string, required bool) error

	// SetActiveStatus sets the active status of a user
	SetActiveStatus(ctx context.Context, id string, isActive bool) error
}

// UserFilter defines filtering options for listing users
type UserFilter struct {
	UserType *string // "STUDENT" or "EMPLOYEE"
	IsActive *bool
	Email    *string
	FullName *string
	Limit    int
	Offset   int
	OrderBy  string // field to order by
	OrderDir string // "ASC" or "DESC"
}
