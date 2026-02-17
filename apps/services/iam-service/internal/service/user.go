package service

import (
	"context"

	"time"

	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/domain"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/dto"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/errors"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/infrastructure/http"
	"github.com/4yrg/gradeloop-core-v2/apps/services/iam-service/internal/utils"
	"github.com/go-playground/validator/v10"
)

type UserService interface {
	CreateUser(ctx context.Context, req dto.CreateUserRequest) (*domain.User, error)
	GetUser(ctx context.Context, id string) (*domain.User, error)
	ListUsers(ctx context.Context, skip, limit int) ([]domain.User, error)
	UpdateUser(ctx context.Context, id string, req dto.UpdateUserRequest) (*domain.User, error)
	DeleteUser(ctx context.Context, id string) error
	AssignRole(ctx context.Context, userID, roleID string) error
}

type userService struct {
	userRepo    domain.UserRepository
	roleRepo    domain.RoleRepository
	auditRepo   domain.AuditRepository
	passwdRepo  domain.PasswordResetRepository
	emailClient http.EmailClient
	validate    *validator.Validate
}

func NewUserService(
	userRepo domain.UserRepository,
	roleRepo domain.RoleRepository,
	auditRepo domain.AuditRepository,
	passwdRepo domain.PasswordResetRepository,
	emailClient http.EmailClient,
) UserService {
	return &userService{
		userRepo:    userRepo,
		roleRepo:    roleRepo,
		auditRepo:   auditRepo,
		passwdRepo:  passwdRepo,
		emailClient: emailClient,
		validate:    validator.New(),
	}
}

func (s *userService) CreateUser(ctx context.Context, req dto.CreateUserRequest) (*domain.User, error) {
	if err := s.validate.Struct(req); err != nil {
		return nil, errors.New(400, "Validation failed", err)
	}

	// Check email uniqueness
	if _, err := s.userRepo.FindByEmail(ctx, req.Email); err == nil {
		return nil, errors.New(409, "Email already exists", nil)
	}

	// Specialization Validation
	if req.UserType == string(domain.UserTypeStudent) {
		if req.EnrollmentDate == nil || req.StudentID == nil {
			return nil, errors.New(400, "Student details (enrollment_date, student_id) are required", nil)
		}
	} else if req.UserType == string(domain.UserTypeEmployee) {
		if req.EmployeeID == nil || req.Designation == nil || req.EmployeeType == nil {
			return nil, errors.New(400, "Employee details (employee_id, designation, employee_type) are required", nil)
		}
	}

	// Create Inactive User
	user := &domain.User{
		Email:                   req.Email,
		FullName:                req.FullName,
		PasswordHash:            "", // No password initially
		UserType:                domain.UserType(req.UserType),
		IsActive:                false,
		IsPasswordResetRequired: true,
		StudentID:               req.StudentID,
		EmployeeID:              req.EmployeeID,
		Designation:             req.Designation,
		EmployeeType:            req.EmployeeType,
	}

	// Parse EnrollmentDate if present
	if req.EnrollmentDate != nil {
		date, err := utils.ParseDate(*req.EnrollmentDate) // Need utils
		if err != nil {
			return nil, errors.New(400, "Invalid enrollment_date format", err)
		}
		user.EnrollmentDate = &date
	}

	// Transactional creation ideally, but for now linear
	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, errors.New(500, "Failed to create user", err)
	}

	// Generate Password Reset Token
	token := utils.GenerateUUID()
	hash := utils.HashToken(token)
	resetToken := &domain.PasswordResetToken{
		UserID:    user.ID,
		TokenHash: hash,
		ExpiresAt: time.Now().Add(24 * time.Hour), // 24h for initial setup?
	}
	if err := s.passwdRepo.Create(ctx, resetToken); err != nil {
		// Cleanup user? Or just fail?
		return nil, errors.New(500, "Failed to create reset token", err)
	}

	// Send Email
	// Assuming frontend URL
	resetLink := "https://gradeloop.com/auth/verify-account?token=" + token
	if err := s.emailClient.SendPasswordResetEmail(ctx, user.Email, resetLink); err != nil {
		// Log error
		// return nil, errors.New(500, "Failed to send email", err)
	}

	// Log Audit
	s.auditRepo.Create(ctx, &domain.AuditLog{
		Action:     "USER_CREATE",
		EntityName: "users",
		EntityID:   user.ID,
	})

	return user, nil
}

func (s *userService) GetUser(ctx context.Context, id string) (*domain.User, error) {
	user, err := s.userRepo.FindByID(ctx, id)
	if err != nil {
		return nil, errors.New(404, "User not found", err)
	}
	return user, nil
}

func (s *userService) ListUsers(ctx context.Context, skip, limit int) ([]domain.User, error) {
	return s.userRepo.FindAll(ctx, skip, limit)
}

func (s *userService) UpdateUser(ctx context.Context, id string, req dto.UpdateUserRequest) (*domain.User, error) {
	user, err := s.userRepo.FindByID(ctx, id)
	if err != nil {
		return nil, errors.New(404, "User not found", err)
	}

	if req.FullName != nil {
		user.FullName = *req.FullName
	}
	if req.IsActive != nil {
		user.IsActive = *req.IsActive
	}

	if err := s.userRepo.Update(ctx, user); err != nil {
		return nil, errors.New(500, "Failed to update user", err)
	}

	s.auditRepo.Create(ctx, &domain.AuditLog{
		Action:     "USER_UPDATE",
		EntityName: "users",
		EntityID:   user.ID,
	})

	return user, nil
}

func (s *userService) DeleteUser(ctx context.Context, id string) error {
	if err := s.userRepo.Delete(ctx, id); err != nil {
		return errors.New(500, "Failed to delete user", err)
	}

	s.auditRepo.Create(ctx, &domain.AuditLog{
		Action:     "USER_DELETE",
		EntityName: "users",
		EntityID:   id,
	})
	return nil
}

func (s *userService) AssignRole(ctx context.Context, userID, roleID string) error {
	if err := s.roleRepo.AssignRole(ctx, userID, roleID); err != nil {
		return errors.New(500, "Failed to assign role", err)
	}

	s.auditRepo.Create(ctx, &domain.AuditLog{
		Action:     "ROLE_ASSIGN",
		EntityName: "users",
		EntityID:   userID,
	})
	return nil
}
