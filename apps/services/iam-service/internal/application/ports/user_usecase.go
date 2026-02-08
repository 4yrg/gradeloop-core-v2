package ports

import (
	"context"
)

// UserUseCase defines the interface for user business operations
type UserUseCase interface {
	// CreateUser creates a new user (student or employee) with validation
	CreateUser(ctx context.Context, req CreateUserRequest) (*CreateUserResponse, error)

	// GetUser retrieves a user by ID with full details
	GetUser(ctx context.Context, userID string) (*GetUserResponse, error)

	// GetUserByEmail retrieves a user by email address
	GetUserByEmail(ctx context.Context, email string) (*GetUserResponse, error)

	// GetUserByStudentRegNo retrieves a user by student registration number
	GetUserByStudentRegNo(ctx context.Context, studentRegNo string) (*GetUserResponse, error)

	// GetUserByEmployeeID retrieves a user by employee ID
	GetUserByEmployeeID(ctx context.Context, employeeID string) (*GetUserResponse, error)

	// UpdateUser updates user information with validation
	UpdateUser(ctx context.Context, req UpdateUserRequest) (*UpdateUserResponse, error)

	// UpdateUserPassword updates user password with validation
	UpdateUserPassword(ctx context.Context, req UpdateUserPasswordRequest) error

	// DeactivateUser deactivates a user account
	DeactivateUser(ctx context.Context, userID string, reason string) error

	// ActivateUser reactivates a user account
	ActivateUser(ctx context.Context, userID string) error

	// DeleteUser soft deletes a user account
	DeleteUser(ctx context.Context, userID string, reason string) error

	// ListUsers retrieves users with filtering and pagination
	ListUsers(ctx context.Context, req ListUsersRequest) (*ListUsersResponse, error)

	// SearchUsers searches users by various criteria
	SearchUsers(ctx context.Context, req SearchUsersRequest) (*SearchUsersResponse, error)

	// RequestPasswordReset initiates password reset process
	RequestPasswordReset(ctx context.Context, email string) error

	// ResetPassword completes password reset with validation
	ResetPassword(ctx context.Context, req ResetPasswordRequest) error

	// ValidateUser validates user credentials
	ValidateUser(ctx context.Context, email string, password string) (*ValidateUserResponse, error)

	// GetUserProfile gets user profile information
	GetUserProfile(ctx context.Context, userID string) (*UserProfileResponse, error)

	// UpdateUserProfile updates user profile information
	UpdateUserProfile(ctx context.Context, req UpdateUserProfileRequest) (*UpdateUserProfileResponse, error)
}

// CreateUserRequest represents the request to create a new user
type CreateUserRequest struct {
	Email    string `json:"email" validate:"required,email"`
	FullName string `json:"full_name" validate:"required,min=2,max=100"`
	Password string `json:"password" validate:"required,min=8"`
	UserType string `json:"user_type" validate:"required,oneof=STUDENT EMPLOYEE"`
	IsActive *bool  `json:"is_active,omitempty"`

	// Student specific fields
	StudentRegNo   *string `json:"student_reg_no,omitempty"`
	EnrollmentDate *string `json:"enrollment_date,omitempty"` // ISO 8601 format

	// Employee specific fields
	EmployeeID  *string `json:"employee_id,omitempty"`
	Designation *string `json:"designation,omitempty"`
}

// CreateUserResponse represents the response after creating a user
type CreateUserResponse struct {
	UserID    string           `json:"user_id"`
	Email     string           `json:"email"`
	FullName  string           `json:"full_name"`
	UserType  string           `json:"user_type"`
	IsActive  bool             `json:"is_active"`
	CreatedAt string           `json:"created_at"`
	Student   *StudentDetails  `json:"student,omitempty"`
	Employee  *EmployeeDetails `json:"employee,omitempty"`
}

// UpdateUserRequest represents the request to update user information
type UpdateUserRequest struct {
	UserID   string  `json:"user_id" validate:"required"`
	FullName *string `json:"full_name,omitempty" validate:"omitempty,min=2,max=100"`
	Email    *string `json:"email,omitempty" validate:"omitempty,email"`

	// Student specific updates
	StudentRegNo   *string `json:"student_reg_no,omitempty"`
	EnrollmentDate *string `json:"enrollment_date,omitempty"`

	// Employee specific updates
	EmployeeID  *string `json:"employee_id,omitempty"`
	Designation *string `json:"designation,omitempty"`
}

// UpdateUserResponse represents the response after updating a user
type UpdateUserResponse struct {
	UserID    string           `json:"user_id"`
	Email     string           `json:"email"`
	FullName  string           `json:"full_name"`
	UserType  string           `json:"user_type"`
	IsActive  bool             `json:"is_active"`
	UpdatedAt string           `json:"updated_at"`
	Student   *StudentDetails  `json:"student,omitempty"`
	Employee  *EmployeeDetails `json:"employee,omitempty"`
}

// UpdateUserPasswordRequest represents password update request
type UpdateUserPasswordRequest struct {
	UserID      string `json:"user_id" validate:"required"`
	OldPassword string `json:"old_password" validate:"required"`
	NewPassword string `json:"new_password" validate:"required,min=8"`
}

// GetUserResponse represents user retrieval response
type GetUserResponse struct {
	UserID    string           `json:"user_id"`
	Email     string           `json:"email"`
	FullName  string           `json:"full_name"`
	UserType  string           `json:"user_type"`
	IsActive  bool             `json:"is_active"`
	CreatedAt string           `json:"created_at"`
	UpdatedAt string           `json:"updated_at"`
	Student   *StudentDetails  `json:"student,omitempty"`
	Employee  *EmployeeDetails `json:"employee,omitempty"`
}

// ListUsersRequest represents request for listing users
type ListUsersRequest struct {
	UserType *string `json:"user_type,omitempty" validate:"omitempty,oneof=STUDENT EMPLOYEE"`
	IsActive *bool   `json:"is_active,omitempty"`
	Limit    int     `json:"limit" validate:"min=1,max=100"`
	Offset   int     `json:"offset" validate:"min=0"`
	OrderBy  string  `json:"order_by,omitempty" validate:"omitempty,oneof=created_at updated_at full_name email"`
	OrderDir string  `json:"order_dir,omitempty" validate:"omitempty,oneof=ASC DESC"`
}

// ListUsersResponse represents response for listing users
type ListUsersResponse struct {
	Users   []GetUserResponse `json:"users"`
	Total   int64             `json:"total"`
	Limit   int               `json:"limit"`
	Offset  int               `json:"offset"`
	HasMore bool              `json:"has_more"`
}

// SearchUsersRequest represents request for searching users
type SearchUsersRequest struct {
	Query    string  `json:"query" validate:"required,min=2"`
	UserType *string `json:"user_type,omitempty" validate:"omitempty,oneof=STUDENT EMPLOYEE"`
	IsActive *bool   `json:"is_active,omitempty"`
	Limit    int     `json:"limit" validate:"min=1,max=100"`
	Offset   int     `json:"offset" validate:"min=0"`
}

// SearchUsersResponse represents response for searching users
type SearchUsersResponse struct {
	Users   []GetUserResponse `json:"users"`
	Total   int64             `json:"total"`
	Query   string            `json:"query"`
	Limit   int               `json:"limit"`
	Offset  int               `json:"offset"`
	HasMore bool              `json:"has_more"`
}

// ResetPasswordRequest represents password reset request
type ResetPasswordRequest struct {
	UserID      string `json:"user_id" validate:"required"`
	NewPassword string `json:"new_password" validate:"required,min=8"`
	ResetToken  string `json:"reset_token" validate:"required"`
}

// ValidateUserResponse represents user validation response
type ValidateUserResponse struct {
	UserID             string           `json:"user_id"`
	Email              string           `json:"email"`
	FullName           string           `json:"full_name"`
	UserType           string           `json:"user_type"`
	IsActive           bool             `json:"is_active"`
	IsPasswordResetReq bool             `json:"is_password_reset_required"`
	LastLoginAt        *string          `json:"last_login_at,omitempty"`
	Student            *StudentDetails  `json:"student,omitempty"`
	Employee           *EmployeeDetails `json:"employee,omitempty"`
}

// UserProfileResponse represents user profile information
type UserProfileResponse struct {
	UserID    string           `json:"user_id"`
	Email     string           `json:"email"`
	FullName  string           `json:"full_name"`
	UserType  string           `json:"user_type"`
	IsActive  bool             `json:"is_active"`
	CreatedAt string           `json:"created_at"`
	UpdatedAt string           `json:"updated_at"`
	Student   *StudentDetails  `json:"student,omitempty"`
	Employee  *EmployeeDetails `json:"employee,omitempty"`
}

// UpdateUserProfileRequest represents user profile update request
type UpdateUserProfileRequest struct {
	UserID   string  `json:"user_id" validate:"required"`
	FullName *string `json:"full_name,omitempty" validate:"omitempty,min=2,max=100"`

	// Student specific profile updates
	StudentRegNo   *string `json:"student_reg_no,omitempty"`
	EnrollmentDate *string `json:"enrollment_date,omitempty"`

	// Employee specific profile updates
	EmployeeID  *string `json:"employee_id,omitempty"`
	Designation *string `json:"designation,omitempty"`
}

// UpdateUserProfileResponse represents user profile update response
type UpdateUserProfileResponse struct {
	UserID    string           `json:"user_id"`
	Email     string           `json:"email"`
	FullName  string           `json:"full_name"`
	UserType  string           `json:"user_type"`
	UpdatedAt string           `json:"updated_at"`
	Student   *StudentDetails  `json:"student,omitempty"`
	Employee  *EmployeeDetails `json:"employee,omitempty"`
}

// StudentDetails represents student-specific information
type StudentDetails struct {
	StudentRegNo   string `json:"student_reg_no"`
	EnrollmentDate string `json:"enrollment_date"`
}

// EmployeeDetails represents employee-specific information
type EmployeeDetails struct {
	EmployeeID  string `json:"employee_id"`
	Designation string `json:"designation"`
}

// Common error types for use cases
type UseCaseError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}

func (e *UseCaseError) Error() string {
	return e.Message
}

// Common error codes
const (
	ErrCodeValidation       = "VALIDATION_ERROR"
	ErrCodeNotFound         = "NOT_FOUND"
	ErrCodeAlreadyExists    = "ALREADY_EXISTS"
	ErrCodeUnauthorized     = "UNAUTHORIZED"
	ErrCodeInvalidPassword  = "INVALID_PASSWORD"
	ErrCodeUserInactive     = "USER_INACTIVE"
	ErrCodePasswordResetReq = "PASSWORD_RESET_REQUIRED"
	ErrCodeInternal         = "INTERNAL_ERROR"
)

// Helper functions for creating common errors
func NewValidationError(message string, details string) *UseCaseError {
	return &UseCaseError{
		Code:    ErrCodeValidation,
		Message: message,
		Details: details,
	}
}

func NewNotFoundError(message string) *UseCaseError {
	return &UseCaseError{
		Code:    ErrCodeNotFound,
		Message: message,
	}
}

func NewAlreadyExistsError(message string) *UseCaseError {
	return &UseCaseError{
		Code:    ErrCodeAlreadyExists,
		Message: message,
	}
}

func NewUnauthorizedError(message string) *UseCaseError {
	return &UseCaseError{
		Code:    ErrCodeUnauthorized,
		Message: message,
	}
}

func NewInternalError(message string, details string) *UseCaseError {
	return &UseCaseError{
		Code:    ErrCodeInternal,
		Message: message,
		Details: details,
	}
}
