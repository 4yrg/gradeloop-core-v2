package usecases

import (
	"context"
	"log"
	"strings"
	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/application/ports"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain"
	"golang.org/x/crypto/bcrypt"
)

type userUseCase struct {
	userRepo ports.UserRepository
	logger   Logger
}

// Logger interface for logging operations
type Logger interface {
	Info(msg string, fields ...interface{})
	Error(msg string, fields ...interface{})
	Debug(msg string, fields ...interface{})
	Warn(msg string, fields ...interface{})
}

// DefaultLogger implements Logger interface using standard log package
type DefaultLogger struct{}

func (l *DefaultLogger) Info(msg string, fields ...interface{}) {
	log.Printf("[INFO] %s %v", msg, fields)
}

func (l *DefaultLogger) Error(msg string, fields ...interface{}) {
	log.Printf("[ERROR] %s %v", msg, fields)
}

func (l *DefaultLogger) Debug(msg string, fields ...interface{}) {
	log.Printf("[DEBUG] %s %v", msg, fields)
}

func (l *DefaultLogger) Warn(msg string, fields ...interface{}) {
	log.Printf("[WARN] %s %v", msg, fields)
}

// NewUserUseCase creates a new user use case instance
func NewUserUseCase(userRepo ports.UserRepository, logger Logger) ports.UserUseCase {
	if logger == nil {
		logger = &DefaultLogger{}
	}
	return &userUseCase{
		userRepo: userRepo,
		logger:   logger,
	}
}

// CreateUser creates a new user with validation
func (u *userUseCase) CreateUser(ctx context.Context, req ports.CreateUserRequest) (*ports.CreateUserResponse, error) {
	u.logger.Info("Creating new user", "email", req.Email, "user_type", req.UserType)

	// Validate request
	if err := u.validateCreateUserRequest(req); err != nil {
		return nil, err
	}

	// Check if user already exists
	existingUser, err := u.userRepo.GetByEmail(ctx, req.Email)
	if err == nil && existingUser != nil {
		return nil, ports.NewAlreadyExistsError("User with this email already exists")
	}

	// Hash password
	hashedPassword, err := u.hashPassword(req.Password)
	if err != nil {
		u.logger.Error("Failed to hash password", "error", err)
		return nil, ports.NewInternalError("Failed to process password", err.Error())
	}

	// Create user entity
	user := &domain.User{
		Email:              req.Email,
		FullName:           req.FullName,
		PasswordHash:       hashedPassword,
		IsActive:           true,
		IsPasswordResetReq: false,
		UserType:           req.UserType,
	}

	// Set active status if provided
	if req.IsActive != nil {
		user.IsActive = *req.IsActive
	}

	// Add type-specific details
	if req.UserType == "STUDENT" {
		if req.StudentRegNo == nil {
			return nil, ports.NewValidationError("Student registration number is required for student users", "missing_student_reg_no")
		}

		// Check if student reg no already exists
		existingStudent, err := u.userRepo.GetByStudentRegNo(ctx, *req.StudentRegNo)
		if err == nil && existingStudent != nil {
			return nil, ports.NewAlreadyExistsError("Student with this registration number already exists")
		}

		enrollmentDate := time.Now()
		if req.EnrollmentDate != nil {
			enrollmentDate, err = time.Parse(time.RFC3339, *req.EnrollmentDate)
			if err != nil {
				return nil, ports.NewValidationError("Invalid enrollment date format", "invalid_date_format")
			}
		}

		user.Student = &domain.Student{
			StudentRegNo:   *req.StudentRegNo,
			EnrollmentDate: enrollmentDate,
		}
	} else if req.UserType == "EMPLOYEE" {
		if req.EmployeeID == nil || req.Designation == nil {
			return nil, ports.NewValidationError("Employee ID and designation are required for employee users", "missing_employee_details")
		}

		// Check if employee ID already exists
		existingEmployee, err := u.userRepo.GetByEmployeeID(ctx, *req.EmployeeID)
		if err == nil && existingEmployee != nil {
			return nil, ports.NewAlreadyExistsError("Employee with this ID already exists")
		}

		user.Employee = &domain.Employee{
			EmployeeID:  *req.EmployeeID,
			Designation: *req.Designation,
		}
	}

	// Create user in repository
	if err := u.userRepo.Create(ctx, user); err != nil {
		u.logger.Error("Failed to create user in repository", "error", err, "email", req.Email)
		return nil, ports.NewInternalError("Failed to create user", err.Error())
	}

	u.logger.Info("User created successfully", "user_id", user.ID, "email", user.Email)

	// Return response
	return u.buildCreateUserResponse(user), nil
}

// GetUser retrieves a user by ID
func (u *userUseCase) GetUser(ctx context.Context, userID string) (*ports.GetUserResponse, error) {
	u.logger.Debug("Getting user by ID", "user_id", userID)

	if userID == "" {
		return nil, ports.NewValidationError("User ID is required", "missing_user_id")
	}

	user, err := u.userRepo.GetByID(ctx, userID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return nil, ports.NewNotFoundError("User not found")
		}
		u.logger.Error("Failed to get user by ID", "error", err, "user_id", userID)
		return nil, ports.NewInternalError("Failed to retrieve user", err.Error())
	}

	return u.buildGetUserResponse(user), nil
}

// GetUserByEmail retrieves a user by email
func (u *userUseCase) GetUserByEmail(ctx context.Context, email string) (*ports.GetUserResponse, error) {
	u.logger.Debug("Getting user by email", "email", email)

	if email == "" {
		return nil, ports.NewValidationError("Email is required", "missing_email")
	}

	user, err := u.userRepo.GetByEmail(ctx, email)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return nil, ports.NewNotFoundError("User not found")
		}
		u.logger.Error("Failed to get user by email", "error", err, "email", email)
		return nil, ports.NewInternalError("Failed to retrieve user", err.Error())
	}

	return u.buildGetUserResponse(user), nil
}

// GetUserByStudentRegNo retrieves a user by student registration number
func (u *userUseCase) GetUserByStudentRegNo(ctx context.Context, studentRegNo string) (*ports.GetUserResponse, error) {
	u.logger.Debug("Getting user by student reg no", "student_reg_no", studentRegNo)

	if studentRegNo == "" {
		return nil, ports.NewValidationError("Student registration number is required", "missing_student_reg_no")
	}

	user, err := u.userRepo.GetByStudentRegNo(ctx, studentRegNo)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return nil, ports.NewNotFoundError("Student not found")
		}
		u.logger.Error("Failed to get user by student reg no", "error", err, "student_reg_no", studentRegNo)
		return nil, ports.NewInternalError("Failed to retrieve student", err.Error())
	}

	return u.buildGetUserResponse(user), nil
}

// GetUserByEmployeeID retrieves a user by employee ID
func (u *userUseCase) GetUserByEmployeeID(ctx context.Context, employeeID string) (*ports.GetUserResponse, error) {
	u.logger.Debug("Getting user by employee ID", "employee_id", employeeID)

	if employeeID == "" {
		return nil, ports.NewValidationError("Employee ID is required", "missing_employee_id")
	}

	user, err := u.userRepo.GetByEmployeeID(ctx, employeeID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return nil, ports.NewNotFoundError("Employee not found")
		}
		u.logger.Error("Failed to get user by employee ID", "error", err, "employee_id", employeeID)
		return nil, ports.NewInternalError("Failed to retrieve employee", err.Error())
	}

	return u.buildGetUserResponse(user), nil
}

// UpdateUser updates user information
func (u *userUseCase) UpdateUser(ctx context.Context, req ports.UpdateUserRequest) (*ports.UpdateUserResponse, error) {
	u.logger.Info("Updating user", "user_id", req.UserID)

	if req.UserID == "" {
		return nil, ports.NewValidationError("User ID is required", "missing_user_id")
	}

	// Get existing user
	user, err := u.userRepo.GetByID(ctx, req.UserID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return nil, ports.NewNotFoundError("User not found")
		}
		return nil, ports.NewInternalError("Failed to retrieve user", err.Error())
	}

	// Update fields if provided
	updated := false

	if req.FullName != nil && *req.FullName != user.FullName {
		user.FullName = *req.FullName
		updated = true
	}

	if req.Email != nil && *req.Email != user.Email {
		// Check if new email already exists
		existingUser, err := u.userRepo.GetByEmail(ctx, *req.Email)
		if err == nil && existingUser != nil && existingUser.ID != user.ID {
			return nil, ports.NewAlreadyExistsError("User with this email already exists")
		}
		user.Email = *req.Email
		updated = true
	}

	// Update type-specific fields
	if user.UserType == "STUDENT" && user.Student != nil {
		if req.StudentRegNo != nil && *req.StudentRegNo != user.Student.StudentRegNo {
			// Check if new student reg no already exists
			existingStudent, err := u.userRepo.GetByStudentRegNo(ctx, *req.StudentRegNo)
			if err == nil && existingStudent != nil && existingStudent.ID != user.ID {
				return nil, ports.NewAlreadyExistsError("Student with this registration number already exists")
			}
			user.Student.StudentRegNo = *req.StudentRegNo
			updated = true
		}

		if req.EnrollmentDate != nil {
			enrollmentDate, err := time.Parse(time.RFC3339, *req.EnrollmentDate)
			if err != nil {
				return nil, ports.NewValidationError("Invalid enrollment date format", "invalid_date_format")
			}
			if !enrollmentDate.Equal(user.Student.EnrollmentDate) {
				user.Student.EnrollmentDate = enrollmentDate
				updated = true
			}
		}
	} else if user.UserType == "EMPLOYEE" && user.Employee != nil {
		if req.EmployeeID != nil && *req.EmployeeID != user.Employee.EmployeeID {
			// Check if new employee ID already exists
			existingEmployee, err := u.userRepo.GetByEmployeeID(ctx, *req.EmployeeID)
			if err == nil && existingEmployee != nil && existingEmployee.ID != user.ID {
				return nil, ports.NewAlreadyExistsError("Employee with this ID already exists")
			}
			user.Employee.EmployeeID = *req.EmployeeID
			updated = true
		}

		if req.Designation != nil && *req.Designation != user.Employee.Designation {
			user.Employee.Designation = *req.Designation
			updated = true
		}
	}

	if !updated {
		return u.buildUpdateUserResponse(user), nil
	}

	// Save updated user
	if err := u.userRepo.Update(ctx, user); err != nil {
		u.logger.Error("Failed to update user", "error", err, "user_id", req.UserID)
		return nil, ports.NewInternalError("Failed to update user", err.Error())
	}

	u.logger.Info("User updated successfully", "user_id", user.ID)

	return u.buildUpdateUserResponse(user), nil
}

// UpdateUserPassword updates user password
func (u *userUseCase) UpdateUserPassword(ctx context.Context, req ports.UpdateUserPasswordRequest) error {
	u.logger.Info("Updating user password", "user_id", req.UserID)

	if req.UserID == "" {
		return ports.NewValidationError("User ID is required", "missing_user_id")
	}

	// Get existing user
	user, err := u.userRepo.GetByID(ctx, req.UserID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return ports.NewNotFoundError("User not found")
		}
		return ports.NewInternalError("Failed to retrieve user", err.Error())
	}

	// Verify old password
	if !u.verifyPassword(req.OldPassword, user.PasswordHash) {
		return ports.NewUnauthorizedError("Invalid current password")
	}

	// Hash new password
	hashedPassword, err := u.hashPassword(req.NewPassword)
	if err != nil {
		u.logger.Error("Failed to hash new password", "error", err)
		return ports.NewInternalError("Failed to process new password", err.Error())
	}

	// Update password
	user.PasswordHash = hashedPassword
	user.IsPasswordResetReq = false // Clear reset flag if set

	if err := u.userRepo.Update(ctx, user); err != nil {
		u.logger.Error("Failed to update user password", "error", err, "user_id", req.UserID)
		return ports.NewInternalError("Failed to update password", err.Error())
	}

	u.logger.Info("User password updated successfully", "user_id", user.ID)

	return nil
}

// DeactivateUser deactivates a user account
func (u *userUseCase) DeactivateUser(ctx context.Context, userID string, reason string) error {
	u.logger.Info("Deactivating user", "user_id", userID, "reason", reason)

	if userID == "" {
		return ports.NewValidationError("User ID is required", "missing_user_id")
	}

	if err := u.userRepo.SetActiveStatus(ctx, userID, false); err != nil {
		if strings.Contains(err.Error(), "not found") {
			return ports.NewNotFoundError("User not found")
		}
		u.logger.Error("Failed to deactivate user", "error", err, "user_id", userID)
		return ports.NewInternalError("Failed to deactivate user", err.Error())
	}

	u.logger.Info("User deactivated successfully", "user_id", userID)

	return nil
}

// ActivateUser reactivates a user account
func (u *userUseCase) ActivateUser(ctx context.Context, userID string) error {
	u.logger.Info("Activating user", "user_id", userID)

	if userID == "" {
		return ports.NewValidationError("User ID is required", "missing_user_id")
	}

	if err := u.userRepo.SetActiveStatus(ctx, userID, true); err != nil {
		if strings.Contains(err.Error(), "not found") {
			return ports.NewNotFoundError("User not found")
		}
		u.logger.Error("Failed to activate user", "error", err, "user_id", userID)
		return ports.NewInternalError("Failed to activate user", err.Error())
	}

	u.logger.Info("User activated successfully", "user_id", userID)

	return nil
}

// DeleteUser soft deletes a user account
func (u *userUseCase) DeleteUser(ctx context.Context, userID string, reason string) error {
	u.logger.Info("Deleting user", "user_id", userID, "reason", reason)

	if userID == "" {
		return ports.NewValidationError("User ID is required", "missing_user_id")
	}

	if err := u.userRepo.Delete(ctx, userID); err != nil {
		if strings.Contains(err.Error(), "not found") {
			return ports.NewNotFoundError("User not found")
		}
		u.logger.Error("Failed to delete user", "error", err, "user_id", userID)
		return ports.NewInternalError("Failed to delete user", err.Error())
	}

	u.logger.Info("User deleted successfully", "user_id", userID)

	return nil
}

// ListUsers retrieves users with filtering and pagination
func (u *userUseCase) ListUsers(ctx context.Context, req ports.ListUsersRequest) (*ports.ListUsersResponse, error) {
	u.logger.Debug("Listing users", "limit", req.Limit, "offset", req.Offset)

	// Set defaults
	if req.Limit == 0 {
		req.Limit = 20
	}
	if req.Limit > 100 {
		req.Limit = 100
	}
	if req.OrderBy == "" {
		req.OrderBy = "created_at"
	}
	if req.OrderDir == "" {
		req.OrderDir = "DESC"
	}

	// Build filter
	filter := ports.UserFilter{
		UserType: req.UserType,
		IsActive: req.IsActive,
		Limit:    req.Limit,
		Offset:   req.Offset,
		OrderBy:  req.OrderBy,
		OrderDir: req.OrderDir,
	}

	users, total, err := u.userRepo.List(ctx, filter)
	if err != nil {
		u.logger.Error("Failed to list users", "error", err)
		return nil, ports.NewInternalError("Failed to retrieve users", err.Error())
	}

	// Build response
	response := &ports.ListUsersResponse{
		Users:   make([]ports.GetUserResponse, len(users)),
		Total:   total,
		Limit:   req.Limit,
		Offset:  req.Offset,
		HasMore: int64(req.Offset+len(users)) < total,
	}

	for i, user := range users {
		response.Users[i] = *u.buildGetUserResponse(user)
	}

	return response, nil
}

// SearchUsers searches users by query
func (u *userUseCase) SearchUsers(ctx context.Context, req ports.SearchUsersRequest) (*ports.SearchUsersResponse, error) {
	u.logger.Debug("Searching users", "query", req.Query, "limit", req.Limit)

	// Set defaults
	if req.Limit == 0 {
		req.Limit = 20
	}
	if req.Limit > 100 {
		req.Limit = 100
	}

	// Search in full name first
	nameFilter := ports.UserFilter{
		UserType: req.UserType,
		IsActive: req.IsActive,
		FullName: &req.Query,
		Limit:    req.Limit,
		Offset:   req.Offset,
		OrderBy:  "full_name",
		OrderDir: "ASC",
	}

	nameUsers, nameTotal, err := u.userRepo.List(ctx, nameFilter)
	if err != nil {
		u.logger.Error("Failed to search users by name", "error", err, "query", req.Query)
		return nil, ports.NewInternalError("Failed to search users", err.Error())
	}

	// Also search by email (partial match)
	emailFilter := ports.UserFilter{
		UserType: req.UserType,
		IsActive: req.IsActive,
		Email:    &req.Query,
		Limit:    req.Limit,
		Offset:   req.Offset,
		OrderBy:  "email",
		OrderDir: "ASC",
	}

	emailUsers, emailTotal, err := u.userRepo.List(ctx, emailFilter)
	if err != nil {
		u.logger.Error("Failed to search users by email", "error", err, "query", req.Query)
		// Don't fail the entire search if email search fails
		emailUsers = []*domain.User{}
		emailTotal = 0
	}

	// Combine results and deduplicate
	userMap := make(map[string]*domain.User)
	for _, user := range nameUsers {
		userMap[user.ID] = user
	}
	for _, user := range emailUsers {
		userMap[user.ID] = user
	}

	// Convert back to slice
	users := make([]*domain.User, 0, len(userMap))
	for _, user := range userMap {
		users = append(users, user)
	}

	// Calculate total (use the higher of the two totals)
	total := nameTotal
	if emailTotal > total {
		total = emailTotal
	}

	// Build response
	response := &ports.SearchUsersResponse{
		Users:   make([]ports.GetUserResponse, len(users)),
		Total:   total,
		Query:   req.Query,
		Limit:   req.Limit,
		Offset:  req.Offset,
		HasMore: int64(req.Offset+len(users)) < total,
	}

	for i, user := range users {
		response.Users[i] = *u.buildGetUserResponse(user)
	}

	return response, nil
}

// RequestPasswordReset initiates password reset process
func (u *userUseCase) RequestPasswordReset(ctx context.Context, email string) error {
	u.logger.Info("Password reset requested", "email", email)

	if email == "" {
		return ports.NewValidationError("Email is required", "missing_email")
	}

	user, err := u.userRepo.GetByEmail(ctx, email)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			// Don't reveal if user exists or not
			u.logger.Info("Password reset requested for non-existent user", "email", email)
			return nil
		}
		return ports.NewInternalError("Failed to retrieve user", err.Error())
	}

	if !user.IsActive {
		return ports.NewValidationError("Cannot reset password for inactive user", "user_inactive")
	}

	// Set password reset required flag
	if err := u.userRepo.SetPasswordResetRequired(ctx, user.ID, true); err != nil {
		u.logger.Error("Failed to set password reset flag", "error", err, "user_id", user.ID)
		return ports.NewInternalError("Failed to initiate password reset", err.Error())
	}

	u.logger.Info("Password reset initiated", "user_id", user.ID)

	// In a real implementation, you would:
	// 1. Generate a secure reset token
	// 2. Store it with expiration
	// 3. Send email with reset link
	// For now, we just set the flag

	return nil
}

// ResetPassword completes password reset
func (u *userUseCase) ResetPassword(ctx context.Context, req ports.ResetPasswordRequest) error {
	u.logger.Info("Completing password reset", "user_id", req.UserID)

	if req.UserID == "" {
		return ports.NewValidationError("User ID is required", "missing_user_id")
	}

	// Get user
	user, err := u.userRepo.GetByID(ctx, req.UserID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return ports.NewNotFoundError("User not found")
		}
		return ports.NewInternalError("Failed to retrieve user", err.Error())
	}

	// In a real implementation, you would validate the reset token here
	// For now, we just check if password reset is required
	if !user.IsPasswordResetReq {
		return ports.NewValidationError("No password reset requested for this user", "no_reset_requested")
	}

	// Hash new password
	hashedPassword, err := u.hashPassword(req.NewPassword)
	if err != nil {
		u.logger.Error("Failed to hash new password", "error", err)
		return ports.NewInternalError("Failed to process new password", err.Error())
	}

	// Update password and clear reset flag
	user.PasswordHash = hashedPassword
	user.IsPasswordResetReq = false

	if err := u.userRepo.Update(ctx, user); err != nil {
		u.logger.Error("Failed to update password", "error", err, "user_id", req.UserID)
		return ports.NewInternalError("Failed to reset password", err.Error())
	}

	u.logger.Info("Password reset completed", "user_id", user.ID)

	return nil
}

// ValidateUser validates user credentials
func (u *userUseCase) ValidateUser(ctx context.Context, email string, password string) (*ports.ValidateUserResponse, error) {
	u.logger.Debug("Validating user credentials", "email", email)

	if email == "" || password == "" {
		return nil, ports.NewValidationError("Email and password are required", "missing_credentials")
	}

	user, err := u.userRepo.GetByEmail(ctx, email)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return nil, ports.NewUnauthorizedError("Invalid credentials")
		}
		return nil, ports.NewInternalError("Failed to retrieve user", err.Error())
	}

	// Verify password
	if !u.verifyPassword(password, user.PasswordHash) {
		u.logger.Warn("Invalid password attempt", "email", email)
		return nil, ports.NewUnauthorizedError("Invalid credentials")
	}

	if !user.IsActive {
		return nil, &ports.UseCaseError{
			Code:    ports.ErrCodeUserInactive,
			Message: "User account is inactive",
		}
	}

	if user.IsPasswordResetReq {
		return nil, &ports.UseCaseError{
			Code:    ports.ErrCodePasswordResetReq,
			Message: "Password reset is required",
		}
	}

	u.logger.Info("User validated successfully", "user_id", user.ID)

	return u.buildValidateUserResponse(user), nil
}

// GetUserProfile gets user profile information
func (u *userUseCase) GetUserProfile(ctx context.Context, userID string) (*ports.UserProfileResponse, error) {
	u.logger.Debug("Getting user profile", "user_id", userID)

	if userID == "" {
		return nil, ports.NewValidationError("User ID is required", "missing_user_id")
	}

	user, err := u.userRepo.GetByID(ctx, userID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return nil, ports.NewNotFoundError("User not found")
		}
		return nil, ports.NewInternalError("Failed to retrieve user profile", err.Error())
	}

	return u.buildUserProfileResponse(user), nil
}

// UpdateUserProfile updates user profile information
func (u *userUseCase) UpdateUserProfile(ctx context.Context, req ports.UpdateUserProfileRequest) (*ports.UpdateUserProfileResponse, error) {
	u.logger.Info("Updating user profile", "user_id", req.UserID)

	if req.UserID == "" {
		return nil, ports.NewValidationError("User ID is required", "missing_user_id")
	}

	// Get existing user
	user, err := u.userRepo.GetByID(ctx, req.UserID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return nil, ports.NewNotFoundError("User not found")
		}
		return nil, ports.NewInternalError("Failed to retrieve user", err.Error())
	}

	// Update allowed profile fields
	updated := false

	if req.FullName != nil && *req.FullName != user.FullName {
		user.FullName = *req.FullName
		updated = true
	}

	// Update type-specific profile fields
	if user.UserType == "STUDENT" && user.Student != nil {
		if req.StudentRegNo != nil && *req.StudentRegNo != user.Student.StudentRegNo {
			// Check if new student reg no already exists
			existingStudent, err := u.userRepo.GetByStudentRegNo(ctx, *req.StudentRegNo)
			if err == nil && existingStudent != nil && existingStudent.ID != user.ID {
				return nil, ports.NewAlreadyExistsError("Student with this registration number already exists")
			}
			user.Student.StudentRegNo = *req.StudentRegNo
			updated = true
		}

		if req.EnrollmentDate != nil {
			enrollmentDate, err := time.Parse(time.RFC3339, *req.EnrollmentDate)
			if err != nil {
				return nil, ports.NewValidationError("Invalid enrollment date format", "invalid_date_format")
			}
			if !enrollmentDate.Equal(user.Student.EnrollmentDate) {
				user.Student.EnrollmentDate = enrollmentDate
				updated = true
			}
		}
	} else if user.UserType == "EMPLOYEE" && user.Employee != nil {
		if req.EmployeeID != nil && *req.EmployeeID != user.Employee.EmployeeID {
			// Check if new employee ID already exists
			existingEmployee, err := u.userRepo.GetByEmployeeID(ctx, *req.EmployeeID)
			if err == nil && existingEmployee != nil && existingEmployee.ID != user.ID {
				return nil, ports.NewAlreadyExistsError("Employee with this ID already exists")
			}
			user.Employee.EmployeeID = *req.EmployeeID
			updated = true
		}

		if req.Designation != nil && *req.Designation != user.Employee.Designation {
			user.Employee.Designation = *req.Designation
			updated = true
		}
	}

	if !updated {
		return u.buildUpdateUserProfileResponse(user), nil
	}

	// Save updated user
	if err := u.userRepo.Update(ctx, user); err != nil {
		u.logger.Error("Failed to update user profile", "error", err, "user_id", req.UserID)
		return nil, ports.NewInternalError("Failed to update user profile", err.Error())
	}

	u.logger.Info("User profile updated successfully", "user_id", user.ID)

	return u.buildUpdateUserProfileResponse(user), nil
}

// Helper methods

func (u *userUseCase) validateCreateUserRequest(req ports.CreateUserRequest) error {
	if req.Email == "" {
		return ports.NewValidationError("Email is required", "missing_email")
	}

	if req.FullName == "" {
		return ports.NewValidationError("Full name is required", "missing_full_name")
	}

	if len(req.FullName) < 2 || len(req.FullName) > 100 {
		return ports.NewValidationError("Full name must be between 2 and 100 characters", "invalid_full_name_length")
	}

	if req.Password == "" {
		return ports.NewValidationError("Password is required", "missing_password")
	}

	if len(req.Password) < 8 {
		return ports.NewValidationError("Password must be at least 8 characters", "password_too_short")
	}

	if req.UserType != "STUDENT" && req.UserType != "EMPLOYEE" {
		return ports.NewValidationError("User type must be STUDENT or EMPLOYEE", "invalid_user_type")
	}

	// Basic email validation
	if !strings.Contains(req.Email, "@") || !strings.Contains(req.Email, ".") {
		return ports.NewValidationError("Invalid email format", "invalid_email_format")
	}

	return nil
}

func (u *userUseCase) hashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

func (u *userUseCase) verifyPassword(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

func (u *userUseCase) buildCreateUserResponse(user *domain.User) *ports.CreateUserResponse {
	response := &ports.CreateUserResponse{
		UserID:    user.ID,
		Email:     user.Email,
		FullName:  user.FullName,
		UserType:  user.UserType,
		IsActive:  user.IsActive,
		CreatedAt: user.CreatedAt.Format(time.RFC3339),
	}

	if user.Student != nil {
		response.Student = &ports.StudentDetails{
			StudentRegNo:   user.Student.StudentRegNo,
			EnrollmentDate: user.Student.EnrollmentDate.Format(time.RFC3339),
		}
	}

	if user.Employee != nil {
		response.Employee = &ports.EmployeeDetails{
			EmployeeID:  user.Employee.EmployeeID,
			Designation: user.Employee.Designation,
		}
	}

	return response
}

func (u *userUseCase) buildGetUserResponse(user *domain.User) *ports.GetUserResponse {
	response := &ports.GetUserResponse{
		UserID:    user.ID,
		Email:     user.Email,
		FullName:  user.FullName,
		UserType:  user.UserType,
		IsActive:  user.IsActive,
		CreatedAt: user.CreatedAt.Format(time.RFC3339),
		UpdatedAt: user.UpdatedAt.Format(time.RFC3339),
	}

	if user.Student != nil {
		response.Student = &ports.StudentDetails{
			StudentRegNo:   user.Student.StudentRegNo,
			EnrollmentDate: user.Student.EnrollmentDate.Format(time.RFC3339),
		}
	}

	if user.Employee != nil {
		response.Employee = &ports.EmployeeDetails{
			EmployeeID:  user.Employee.EmployeeID,
			Designation: user.Employee.Designation,
		}
	}

	return response
}

func (u *userUseCase) buildUpdateUserResponse(user *domain.User) *ports.UpdateUserResponse {
	response := &ports.UpdateUserResponse{
		UserID:    user.ID,
		Email:     user.Email,
		FullName:  user.FullName,
		UserType:  user.UserType,
		IsActive:  user.IsActive,
		UpdatedAt: user.UpdatedAt.Format(time.RFC3339),
	}

	if user.Student != nil {
		response.Student = &ports.StudentDetails{
			StudentRegNo:   user.Student.StudentRegNo,
			EnrollmentDate: user.Student.EnrollmentDate.Format(time.RFC3339),
		}
	}

	if user.Employee != nil {
		response.Employee = &ports.EmployeeDetails{
			EmployeeID:  user.Employee.EmployeeID,
			Designation: user.Employee.Designation,
		}
	}

	return response
}

func (u *userUseCase) buildValidateUserResponse(user *domain.User) *ports.ValidateUserResponse {
	response := &ports.ValidateUserResponse{
		UserID:             user.ID,
		Email:              user.Email,
		FullName:           user.FullName,
		UserType:           user.UserType,
		IsActive:           user.IsActive,
		IsPasswordResetReq: user.IsPasswordResetReq,
	}

	if user.Student != nil {
		response.Student = &ports.StudentDetails{
			StudentRegNo:   user.Student.StudentRegNo,
			EnrollmentDate: user.Student.EnrollmentDate.Format(time.RFC3339),
		}
	}

	if user.Employee != nil {
		response.Employee = &ports.EmployeeDetails{
			EmployeeID:  user.Employee.EmployeeID,
			Designation: user.Employee.Designation,
		}
	}

	return response
}

func (u *userUseCase) buildUserProfileResponse(user *domain.User) *ports.UserProfileResponse {
	response := &ports.UserProfileResponse{
		UserID:    user.ID,
		Email:     user.Email,
		FullName:  user.FullName,
		UserType:  user.UserType,
		IsActive:  user.IsActive,
		CreatedAt: user.CreatedAt.Format(time.RFC3339),
		UpdatedAt: user.UpdatedAt.Format(time.RFC3339),
	}

	if user.Student != nil {
		response.Student = &ports.StudentDetails{
			StudentRegNo:   user.Student.StudentRegNo,
			EnrollmentDate: user.Student.EnrollmentDate.Format(time.RFC3339),
		}
	}

	if user.Employee != nil {
		response.Employee = &ports.EmployeeDetails{
			EmployeeID:  user.Employee.EmployeeID,
			Designation: user.Employee.Designation,
		}
	}

	return response
}

func (u *userUseCase) buildUpdateUserProfileResponse(user *domain.User) *ports.UpdateUserProfileResponse {
	response := &ports.UpdateUserProfileResponse{
		UserID:    user.ID,
		Email:     user.Email,
		FullName:  user.FullName,
		UserType:  user.UserType,
		UpdatedAt: user.UpdatedAt.Format(time.RFC3339),
	}

	if user.Student != nil {
		response.Student = &ports.StudentDetails{
			StudentRegNo:   user.Student.StudentRegNo,
			EnrollmentDate: user.Student.EnrollmentDate.Format(time.RFC3339),
		}
	}

	if user.Employee != nil {
		response.Employee = &ports.EmployeeDetails{
			EmployeeID:  user.Employee.EmployeeID,
			Designation: user.Employee.Designation,
		}
	}

	return response
}
